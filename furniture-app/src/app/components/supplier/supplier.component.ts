// supplier.component.ts
import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { SupplierService } from '../../services/supplier.service';
import { Modal } from 'bootstrap';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { Supplier, PaginationResponse } from '../../models/supplier.model';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';

@Component({
  selector: 'app-supplier',
  imports: [CommonModule, FormsModule, RouterModule],
  standalone: true,
  templateUrl: './supplier.component.html',
  styleUrl: './supplier.component.css'
})
export class SupplierComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('supplierModal') modalElement!: ElementRef;
  private modal!: Modal;

  // Data and pagination
  suppliers: Supplier[] = [];
  totalItems: number = 0;
  itemsPerPage: number = 10;
  currentPage: number = 1;
  totalPages: number = 0;
  pages: number[] = [];
  
  // Items per page options
  itemsPerPageOptions: number[] = [5, 10, 20, 50, 100];
  
  // Search and sort
  searchTerm: string = '';
  sortColumn: string = 'SupplierID';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Form and edit state
  isEdit: boolean = false;
  file: File | null = null;
  fileName: string = '';
  newSupplier: Supplier = this.resetSupplierObject();
  
  // Upload progress tracking
  uploadProgress: number = 0;
  isUploading: boolean = false;
  showProgress: boolean = false;
  uploadMessage: string = '';
  uploadStatus: 'idle' | 'processing' | 'success' | 'error' = 'idle';
  uploadJobId: string = '';
  pollInterval: any = null;
  Math = Math;
  // RxJS subscriptions
  private searchSubject = new Subject<string>();
  private uploadSubscription: Subscription | null = null;
  private progressSubscription: Subscription | null = null;
  
  constructor(private supplierService: SupplierService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadSuppliers();
    
    // Set up search debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.currentPage = 1; // Reset to first page on new search
      this.searchSuppliers(query);
    });
  }

  ngAfterViewInit() {
    this.modal = new Modal(this.modalElement.nativeElement);
  }
  
  ngOnDestroy() {
    if (this.uploadSubscription) {
      this.uploadSubscription.unsubscribe();
    }
    
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    this.searchSubject.complete();
  }
  
  /**
   * Load suppliers with server-side pagination
   */
  loadSuppliers() {
    this.supplierService.getSuppliers(this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        this.suppliers = response.data;
        this.updatePaginationInfo(response.pagination);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error fetching suppliers', error);
      }
    });
  }
  
  /**
   * Update pagination information from server response
   */
  updatePaginationInfo(pagination: any) {
    this.totalItems = pagination.total;
    this.currentPage = pagination.current_page;
    this.itemsPerPage = pagination.per_page;
    this.totalPages = pagination.last_page;
    
    // Generate page numbers array for pagination controls
    this.generatePageNumbers();
  }
  
  /**
   * Generate page numbers for pagination component
   * Shows at most 5 pages with current page in middle when possible
   */
  generatePageNumbers() {
    this.pages = [];
    
    if (this.totalPages <= 5) {
      // If 5 or fewer pages, show all
      for (let i = 1; i <= this.totalPages; i++) {
        this.pages.push(i);
      }
    } else {
      // More than 5 pages, show current page in middle when possible
      let start = Math.max(1, this.currentPage - 2);
      let end = Math.min(this.totalPages, start + 4);
      
      // Adjust start if end is at max
      if (end === this.totalPages) {
        start = Math.max(1, end - 4);
      }
      
      for (let i = start; i <= end; i++) {
        this.pages.push(i);
      }
    }
  }
  
  /**
   * Handle file selection for Excel import
   */
  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      // Validate file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File is too large. Maximum size is 10MB.');
        input.value = '';
        this.file = null;
        this.fileName = '';
        return;
      }
      
      // Validate file type
      const validExtensions = ['.xlsx', '.xls'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!validExtensions.includes(fileExt)) {
        alert('Only Excel files (.xlsx, .xls) are allowed');
        input.value = '';
        this.file = null;
        this.fileName = '';
        return;
      }
      
      this.file = file;
      this.fileName = file.name;
      this.uploadStatus = 'idle';
      this.uploadProgress = 0;
    }
  }
  
  /**
   * Upload Excel file for bulk import
   */
  uploadExcel() {
    if (!this.file || this.isUploading) {
      return;
    }

    this.isUploading = true;
    this.showProgress = true;
    this.uploadStatus = 'processing';
    this.uploadProgress = 0;
    this.uploadMessage = 'Preparing file for upload...';

    const formData = new FormData();
    formData.append('file', this.file);

    if (this.uploadSubscription) {
      this.uploadSubscription.unsubscribe();
    }
    
    this.uploadSubscription = this.supplierService.uploadExcelFile(formData).subscribe({
      next: (response) => {
        if (response.jobId) {
          // Start polling for progress if this is a background job
          this.uploadJobId = response.jobId;
          this.uploadMessage = 'Processing file in background...';
          this.startProgressPolling();
        } else {
          // Direct response (small files)
          this.handleUploadSuccess(response);
        }
      },
      error: (error) => {
        this.handleUploadError(error);
      }
    });
  }
  
  /**
   * Start polling for upload progress
   */
  startProgressPolling() {
    // Clear any existing interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    // Poll every 2 seconds
    this.pollInterval = setInterval(() => {
      this.checkUploadProgress();
    }, 2000);
  }
  
  /**
   * Check upload job progress
   */
  checkUploadProgress() {
    if (!this.uploadJobId) return;
    
    this.supplierService.checkJobProgress(this.uploadJobId).subscribe({
      next: (progressData: any) => {
        this.uploadProgress = progressData.percentage || 0;
        this.uploadMessage = progressData.message || 'Processing...';
        
        // Job completed
        if (progressData.status === 'completed') {
          this.handleUploadSuccess(progressData);
          clearInterval(this.pollInterval);
        } 
        // Job failed
        else if (progressData.status === 'failed') {
          this.handleUploadError(new Error(progressData.message || 'Upload failed'));
          clearInterval(this.pollInterval);
        }
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error checking progress:', error);
        // Don't stop polling on temporary errors
      }
    });
  }
  
  /**
   * Handle successful upload completion
   */
  handleUploadSuccess(response: any) {
    this.uploadStatus = 'success';
    this.isUploading = false;
    this.uploadProgress = 100;
    
    const successCount = response.stats?.successful || 0;
    const failureCount = response.stats?.failed || 0;
    
    if (failureCount > 0) {
      this.uploadMessage = `Upload completed with ${successCount} successful and ${failureCount} failed records.`;
      console.warn('Failed records:', response.failures);
    } else {
      this.uploadMessage = `Successfully processed ${successCount} records.`;
      alert('Upload completed successfully!');
    }
    
    this.file = null;
    this.fileName = '';
    
    // Refresh the supplier list
    this.loadSuppliers();
    
    // Hide progress after 5 seconds
    setTimeout(() => {
      this.showProgress = false;
      this.uploadProgress = 0;
      this.uploadStatus = 'idle';
      this.cdr.detectChanges();
    }, 5000);
  }
  
  /**
   * Handle upload error
   */
  handleUploadError(error: any) {
    this.uploadStatus = 'error';
    this.isUploading = false;
    this.uploadMessage = `Error: ${error.message || 'Upload failed'}`;
    console.error('Upload error:', error);
    
    // Hide progress after 5 seconds
    setTimeout(() => {
      this.showProgress = false;
      this.uploadStatus = 'idle';
      this.cdr.detectChanges();
    }, 5000);
  }
  
  /**
   * Cancel ongoing upload
   */
  cancelUpload() {
    if (this.uploadJobId && this.isUploading) {
      this.supplierService.cancelJob(this.uploadJobId).subscribe({
        next: () => {
          this.uploadStatus = 'idle';
          this.isUploading = false;
          this.showProgress = false;
          this.uploadMessage = 'Upload cancelled';
          
          if (this.pollInterval) {
            clearInterval(this.pollInterval);
          }
        },
        error: (error) => {
          console.error('Error cancelling job:', error);
        }
      });
    }
  }

  /**
   * Open supplier modal for add/edit
   */
  openModal() {
    if (!this.isEdit) {
      this.newSupplier = this.resetSupplierObject();
    }
    this.modal.show();
  }

  /**
   * Close supplier modal
   */
  closeModal() {
    this.modal.hide();
    this.newSupplier = this.resetSupplierObject();
    this.isEdit = false;
  }

  /**
   * Reset supplier object to default values
   */
  resetSupplierObject(): Supplier {
    return {
      SupplierID: -1,
      SupplierCode: '',
      SupplierName: '',
      SupplierAddress: '', 
      EmailAddress: '',
    };
  }

  /**
   * Open edit modal for supplier
   */
  editSupplier(supplier: Supplier) {
    this.newSupplier = { ...supplier };
    this.isEdit = true;
    this.openModal();
  }

  /**
   * Delete supplier after confirmation
   */
  deleteSupplier(supplierID: number) {
    if (confirm('Are you sure you want to delete this supplier?')) {
      this.supplierService.deleteSupplier(supplierID).subscribe({
        next: () => {
          // Reload the current page
          this.loadSuppliers();
        },
        error: (error) => {
          console.error('Error deleting supplier', error);
        }
      });
    }
  }

  /**
   * Save supplier (create or update)
   */
  saveSupplier() {
    if (!this.newSupplier.SupplierCode || !this.newSupplier.SupplierName || !this.newSupplier.SupplierAddress) {
      alert('Please fill all the required fields.');
      return;
    }

    if (this.isEdit) {
      this.supplierService.updateSupplier(this.newSupplier).subscribe({
        next: () => {
          this.loadSuppliers();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error updating supplier', error);
        }
      });
    } else {
      this.supplierService.addSupplier(this.newSupplier).subscribe({
        next: () => {
          this.loadSuppliers();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error adding supplier', error);
        }
      });
    }
  }

  /**
   * Sort suppliers by column
   */
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.currentPage = 1; // Reset to first page on sort change
    this.supplierService.sortSuppliers(this.sortColumn, this.sortDirection, this.currentPage, this.itemsPerPage)
      .subscribe({
        next: (response) => {
          this.suppliers = response.data;
          this.updatePaginationInfo(response.pagination);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error sorting suppliers:', error);
        }
      });
  }
  
  /**
   * Handle search input changes
   */
  onSearchChange() {
    this.searchSubject.next(this.searchTerm);
  }

  /**
   * Search suppliers with server-side filtering
   */
  searchSuppliers(query: string) {
    this.supplierService.searchSuppliers(query, this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        this.suppliers = response.data;
        this.updatePaginationInfo(response.pagination);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error searching suppliers:', error);
      }
    });
  }

  /**
   * Navigate to previous page
   */
  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadCurrentPageData();
    }
  }

  /**
   * Navigate to next page
   */
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadCurrentPageData();
    }
  }

  /**
   * Go to specific page
   */
  goToPage(page: number) {
    if (page !== this.currentPage && page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadCurrentPageData();
    }
  }

  /**
   * Load data for current page (handles search vs normal pagination)
   */
  loadCurrentPageData() {
    if (this.searchTerm) {
      this.searchSuppliers(this.searchTerm);
    } else if (this.sortColumn !== 'SupplierID' || this.sortDirection !== 'asc') {
      this.supplierService.sortSuppliers(this.sortColumn, this.sortDirection, this.currentPage, this.itemsPerPage)
        .subscribe({
          next: (response) => {
            this.suppliers = response.data;
            this.updatePaginationInfo(response.pagination);
          },
          error: (error) => console.error('Error loading page:', error)
        });
    } else {
      this.loadSuppliers();
    }
  }
  
  /**
   * Change items per page
   */
  changeItemsPerPage(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(select.value, 10);
    this.currentPage = 1; // Reset to first page
    this.loadCurrentPageData();
  }
  
  /**
   * Check if current pagination state has previous page
   */
  get hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }
  
  /**
   * Check if current pagination state has next page
   */
  get hasNextPage(): boolean {
    return this.currentPage < this.totalPages;
  }
}