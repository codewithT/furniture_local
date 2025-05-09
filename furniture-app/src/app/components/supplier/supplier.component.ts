import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { SupplierService } from '../../services/supplier.service';
import { Modal } from 'bootstrap';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { Supplier } from '../../models/supplier.model';
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

  suppliers: Supplier[] = [];
  entriesPerPage: number = 20;
  currentPage: number = 1;
  searchTerm: string = '';
  isEdit: boolean = false;
  file: File | null = null;
  newSupplier: Supplier = {
    SupplierID: -1,
    SupplierCode: '',
    SupplierName: '',
    SupplierAddress: '', 
    EmailAddress: '',
  };
  
  // Upload progress tracking
  uploadProgress: number = 0;
  isUploading: boolean = false;
  showProgress: boolean = false;
  uploadMessage: string = '';
  uploadStatus: 'idle' | 'processing' | 'success' | 'error' = 'idle';
  uploadJobId: string = '';
  pollInterval: any = null;
  
  private searchSubject = new Subject<string>();
  private uploadSubscription: Subscription | null = null;
  private progressSubscription: Subscription | null = null;
  
  constructor(private supplierService: SupplierService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadSuppliers();
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.searchSuppliers(query);
    });
  }

  ngAfterViewInit() {
    this.modal = new Modal(this.modalElement.nativeElement);
  }
  
  ngOnDestroy() {
    if (this.uploadSubscription) {
      this.uploadSubscription.unsubscribe();
      this.uploadSubscription = null;
    }
    
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
      this.progressSubscription = null;
    }
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    this.searchSubject.complete();
  }
  
  loadSuppliers() {
    this.supplierService.getSupplierDetails().subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          this.suppliers = data;
          this.updatePagination();
          this.cdr.detectChanges();
        } else {
          console.error('Data is not an array:', data);
        }
      },
      error: (error) => {
        console.error('Error fetching suppliers', error);
      }
    });
  }
  
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
  
  fileName: string = '';
  
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
      this.uploadSubscription = null;
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
  
  checkUploadProgress() {
    if (!this.uploadJobId) return;
    
    this.supplierService.checkJobProgress(this.uploadJobId).subscribe({
      next: (progressData : any) => {
        this.uploadProgress = progressData.percentage || 0;
        this.uploadMessage = progressData.message || 'Processing...';
        
        // Job completed
        if (progressData.status === 'completed') {
          this.handleUploadSuccess(progressData);
          clearInterval(this.pollInterval);
        } 
        // Job failed
        else if (progressData.status === 'failed') {
          this.handleUploadError(new Error(progressData.error || 'Upload failed'));
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
    
    this.cdr.detectChanges();
  }
  
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
    
    this.cdr.detectChanges();
  }
  
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
          
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error cancelling job:', error);
        }
      });
    }
  }

  openModal() {
    if (!this.isEdit) {
      this.resetSupplier();
    }
    this.modal.show();
  }

  closeModal() {
    this.modal.hide();
    this.resetSupplier();
    this.isEdit = false;
  }

  resetSupplier() {
    this.newSupplier = {
      SupplierID: -1,
      SupplierCode: '',
      SupplierName: '',
      SupplierAddress: '', 
      EmailAddress: '',
    };
  }

  editSupplier(supplier: Supplier) {
    this.newSupplier = { ...supplier };
    this.isEdit = true;
    this.openModal();
  }

  deleteSupplier(supplierID: number) {
    if (confirm('Are you sure you want to delete this supplier?')) {
      this.supplierService.deleteSupplier(supplierID).subscribe({
        next: () => {
          this.suppliers = this.suppliers.filter(p => p.SupplierID !== supplierID);
          this.updatePagination();
        },
        error: (error) => {
          console.error('Error deleting supplier', error);
        }
      });
    }
  }

  saveSupplier() {
    if (!this.newSupplier.SupplierCode || !this.newSupplier.SupplierName || !this.newSupplier.SupplierAddress) {
      alert('Please fill all the required fields.');
      return;
    }

    if (this.isEdit) {
      this.supplierService.updateSupplier(this.newSupplier).subscribe({
        next: () => {
          const index = this.suppliers.findIndex(s => s.SupplierID === this.newSupplier.SupplierID);
          if (index !== -1) {
            this.suppliers[index] = { ...this.newSupplier };  
          }
          this.loadSuppliers();
          this.closeModal();
        },
        error: (error) => {
          console.error('Error updating supplier', error);
        }
      });
    } else {
      this.supplierService.addSupplier(this.newSupplier).subscribe({
        next: (newSupplier) => {
          this.suppliers = [...this.suppliers, newSupplier]; 
          this.closeModal();
          this.updatePagination();
        },
        error: (error) => {
          console.error('Error adding supplier', error);
        }
      });
    }
  }

  sortColumn: keyof Supplier | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  sortBy(column: keyof Supplier) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.supplierService.sortSuppliers(this.sortColumn, this.sortDirection, this.currentPage, this.entriesPerPage).subscribe(
      (data: Supplier[]) => {
        this.suppliers = data;
      },
      (error) => console.error('Error sorting suppliers:', error)
    );
  }
  
  onSearchChange() {
    this.searchSubject.next(this.searchTerm);
  }

  searchSuppliers(query: string) {
    this.supplierService.searchSuppliers(query).subscribe(
      (data: Supplier[]) => {
        this.suppliers = data;
        this.updatePagination();
      },
      error => console.error('Error fetching suppliers:', error)
    );
  }

  get totalPages() {
    return Math.ceil(this.suppliers.length / this.entriesPerPage);
  }

  get paginatedSuppliers() {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    return this.suppliers.slice(start, start + this.entriesPerPage);
  }

  updatePagination() {
    if (this.currentPage > this.totalPages) {
      this.currentPage = Math.max(1, this.totalPages);
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.searchSuppliers(this.searchTerm);
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.searchSuppliers(this.searchTerm);
    }
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.searchSuppliers(this.searchTerm);
  }

  get totalPagesArray() {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
}