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
  private searchSubject = new Subject<string>(); // Helps debounce search input
  constructor(private supplierService: SupplierService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadSuppliers();
    this.searchSubject.pipe(
      debounceTime(300), // Wait 300ms after the last keystroke
      distinctUntilChanged() // Only call API if value actually changes
    ).subscribe(query => {
      this.searchSuppliers(query);
    });
  }

  ngAfterViewInit() {
    this.modal = new Modal(this.modalElement.nativeElement);
  }
  ngOnDestroy() {
    // Clean up any subscriptions when component is destroyed
    if (this.uploadSubscription) {
      this.uploadSubscription.unsubscribe();
      this.uploadSubscription = null;
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
      this.file = input.files[0];  
      this.fileName = this.file.name;  // Update the displayed file name
    }
  }
  fileName: string = '';
  isUploading = false;
  
  uploadSubscription: Subscription | null = null;

uploadExcel() {
  if (!this.file || this.isUploading) {
    return;
  }

  this.isUploading = true;

  const formData = new FormData();
  formData.append('file', this.file);

  if (this.uploadSubscription) {
    this.uploadSubscription.unsubscribe();
    this.uploadSubscription = null;
  }
  
  this.uploadSubscription = this.supplierService.uploadExcelFile(formData).subscribe({
    next: () => {
      alert("Upload Successful");
      this.isUploading = false;
      this.file = null;
      this.fileName = '';
      // Refresh the supplier list
      this.loadSuppliers();
      // Complete and clean up the subscription
      if (this.uploadSubscription) {
        this.uploadSubscription.unsubscribe();
        this.uploadSubscription = null;
      }
    },
    error: (error) => {
      alert(`Error on uploading: ${error}`);
      this.isUploading = false;
      // Clean up on error too
      if (this.uploadSubscription) {
        this.uploadSubscription.unsubscribe();
        this.uploadSubscription = null;
      }
    },
    complete: () => {
      // Make sure to clean up on complete too
      if (this.uploadSubscription) {
        this.uploadSubscription.unsubscribe();
        this.uploadSubscription = null;
      }
    }
  });
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
      this.supplierService.deleteSupplier(supplierID).subscribe(() => {
        this.suppliers = this.suppliers.filter(p => p.SupplierID !== supplierID);
        this.updatePagination();
      }, (error) => {
        console.error('Error deleting supplier', error);
      });
    }
  }

  saveSupplier() {
    if (!this.newSupplier.SupplierCode || !this.newSupplier.SupplierName || !this.newSupplier.SupplierAddress) {
      alert('Please fill all the required fields.');
      return;
    }

    if (this.isEdit) {
      this.supplierService.updateSupplier(this.newSupplier).subscribe(() => {
        const index = this.suppliers.findIndex(s => s.SupplierID === this.newSupplier.SupplierID);
        if (index !== -1) {
          this.suppliers[index] = { ...this.newSupplier };  
        }
        this.loadSuppliers();
        this.cdr.detectChanges();
        this.closeModal();
      }, (error) => {
        console.error('Error updating supplier', error);
      });
    } else {
      this.supplierService.addSupplier(this.newSupplier).subscribe((newSupplier) => {
        
        this.suppliers = [...this.suppliers, newSupplier]; 
        this.cdr.detectChanges();
        this.closeModal();
        this.updatePagination();
      }, (error) => {
        console.error('Error adding supplier', error);
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
    this.searchSubject.next(this.searchTerm); // Push value into the Subject
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
