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
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
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
private progressErrorCount: number = 0;
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
  
  constructor(private supplierService: SupplierService, private cdr: ChangeDetectorRef,
    public authService: AuthService, private snackBar : MatSnackBar,
  ) {}

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
    
    // Reset previous state
    this.uploadStatus = 'idle';
    this.uploadProgress = 0;
    this.showProgress = false;
    this.uploadMessage = '';
    
    // Validate file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.snackBar.open('File is too large. Maximum size is 10MB.', 'Close', {
        duration: 3000,
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      input.value = '';
      this.file = null;
      this.fileName = '';
      return;
    }
    
    // Validate file type
    const validExtensions = ['.xlsx', '.xls'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExt)) {
      this.snackBar.open('Only Excel files (.xlsx, .xls) are allowed', 'Close', {
        duration: 3000,
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      input.value = '';
      this.file = null;
      this.fileName = '';
      return;
    }
    
    // File is valid
    this.file = file;
    this.fileName = file.name;
    
    console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
  }
}
  
  /**
   * Upload Excel file for bulk import
   */
 uploadExcel() {
  if (!this.file || this.isUploading) {
    return;
  }

  // Reset upload state
  this.isUploading = true;
  this.showProgress = true;
  this.uploadStatus = 'processing';
  this.uploadProgress = 0;
  this.uploadMessage = 'Preparing file for upload...';
  this.uploadJobId = '';

  const formData = new FormData();
  formData.append('file', this.file);

  // Clear any existing subscription
  if (this.uploadSubscription) {
    this.uploadSubscription.unsubscribe();
  }
  
  // Clear any existing polling interval
  if (this.pollInterval) {
    clearInterval(this.pollInterval);
  }
  
  this.uploadSubscription = this.supplierService.uploadExcelFile(formData).subscribe({
    next: (response) => {
      console.log('Upload response:', response);
      
      if (response.jobId) {
        // Background job started
        this.uploadJobId = response.jobId;
        this.uploadMessage = 'File uploaded. Processing in background...';
        this.uploadProgress = 10;
        this.startProgressPolling();
      } else {
        // Direct response (should not happen with current backend)
        this.handleUploadSuccess(response);
      }
    },
    error: (error) => {
      console.error('Upload error:', error);
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
  
  // Initial progress check
  this.checkUploadProgress();
  
  // Poll every 2 seconds
  this.pollInterval = setInterval(() => {
    this.checkUploadProgress();
  }, 2000);
}
  
  /**
   * Check upload job progress
   */
checkUploadProgress() {
  if (!this.uploadJobId) {
    console.error('No job ID available for progress check');
    return;
  }

  this.supplierService.checkJobProgress(this.uploadJobId).subscribe({
    next: (progressData: any) => {
      console.log('Progress data:', progressData);
      
      // Update progress information
      this.uploadProgress = Math.max(0, Math.min(100, progressData.percentage || 0));
      this.uploadMessage = progressData.message || 'Processing...';
      
      // Handle different job statuses
      switch (progressData.status) {
        case 'completed':
          this.handleUploadSuccess(progressData);
          this.stopProgressPolling();
          break;
          
        case 'failed':
          this.handleUploadError(new Error(progressData.message || 'Upload failed'));
          this.stopProgressPolling();
          break;
          
        case 'cancelled':
          this.handleUploadCancelled();
          this.stopProgressPolling();
          break;
          
        case 'processing':
          // Continue polling
          break;
          
        default:
          console.warn('Unknown job status:', progressData.status);
          break;
      }
      
      // Force change detection
      this.cdr.detectChanges();
    },
    error: (error) => {
      console.error('Error checking progress:', error);
      
      // Don't stop polling immediately on error - could be temporary
      // But stop after too many consecutive errors
      if (!this.progressErrorCount) {
        this.progressErrorCount = 0;
      }
      
      this.progressErrorCount++;
      
      if (this.progressErrorCount >= 5) {
        this.handleUploadError(new Error('Failed to check progress after multiple attempts'));
        this.stopProgressPolling();
      }
    }
  });
}
stopProgressPolling() {
  if (this.pollInterval) {
    clearInterval(this.pollInterval);
    this.pollInterval = null;
  }
  this.progressErrorCount = 0;
}

  
  /**
   * Handle successful upload completion
   */
handleUploadSuccess(response: any) {
  console.log('Upload success response:', response);
  
  this.uploadStatus = 'success';
  this.isUploading = false;
  this.uploadProgress = 100;
  
  // Extract statistics
  const stats = response.stats || {};
  const successCount = stats.successful || response.loaded || 0;
  const failureCount = stats.failed || 0;
  const totalCount = stats.total || successCount + failureCount;
  
  // Create appropriate success message
  if (failureCount > 0) {
    this.uploadMessage = `Upload completed! ${successCount} of ${totalCount} records processed successfully. ${failureCount} failed.`;
    
    // Log failures for debugging
    if (response.failures && response.failures.length > 0) {
      console.warn('Failed records:', response.failures);
    }
    
    // Show warning snackbar
    this.snackBar.open(
      `Upload completed with ${failureCount} errors. Check console for details.`,
      'Close',
      {
        duration: 5000,
        verticalPosition: 'top',
        horizontalPosition: 'center'
      }
    );
  } else {
    this.uploadMessage = `Upload completed successfully! ${successCount} records processed.`;
    
    // Show success snackbar
    this.snackBar.open(
      `Successfully processed ${successCount} records`,
      'Close',
      {
        duration: 3000,
        verticalPosition: 'top',
        horizontalPosition: 'center'
      }
    );
  }
  
  // Clear file selection
  this.file = null;
  this.fileName = '';
  
  // Clear file input
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  if (fileInput) {
    fileInput.value = '';
  }
  
  // Refresh the supplier list
  this.loadSuppliers();
  
  // Hide progress after 5 seconds
  setTimeout(() => {
    this.showProgress = false;
    this.uploadProgress = 0;
    this.uploadStatus = 'idle';
    this.uploadMessage = '';
    this.cdr.detectChanges();
  }, 5000);
}

  handleUploadCancelled() {
  this.uploadStatus = 'idle';
  this.isUploading = false;
  this.uploadMessage = 'Upload cancelled';
  
  this.snackBar.open('Upload cancelled', 'Close', {
    duration: 3000,
    verticalPosition: 'top',
    horizontalPosition: 'center'
  });
  
  // Hide progress after 3 seconds
  setTimeout(() => {
    this.showProgress = false;
    this.uploadProgress = 0;
    this.uploadStatus = 'idle';
    this.uploadMessage = '';
    this.cdr.detectChanges();
  }, 3000);
}
  /**
   * Handle upload error
   */
handleUploadError(error: any) {
  console.error('Upload error:', error);
  
  this.uploadStatus = 'error';
  this.isUploading = false;
  
  // Extract error message
  let errorMessage = 'Upload failed';
  if (error?.error?.message) {
    errorMessage = error.error.message;
  } else if (error?.message) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  this.uploadMessage = `Error: ${errorMessage}`;
  
  // Show error snackbar
  this.snackBar.open(
    `Upload failed: ${errorMessage}`,
    'Close',
    {
      duration: 5000,
      verticalPosition: 'top',
      horizontalPosition: 'center'
    }
  );
  
  // Hide progress after 5 seconds
  setTimeout(() => {
    this.showProgress = false;
    this.uploadStatus = 'idle';
    this.uploadMessage = '';
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
        console.log('Job cancelled successfully');
        this.handleUploadCancelled();
        this.stopProgressPolling();
      },
      error: (error) => {
        console.error('Error cancelling job:', error);
        this.snackBar.open('Failed to cancel upload', 'Close', {
          duration: 3000,
          verticalPosition: 'top',
          horizontalPosition: 'center'
        });
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