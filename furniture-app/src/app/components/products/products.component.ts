import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PaginationResponse } from '../../models/product.model';
import { Modal } from 'bootstrap';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';

import { Subject, Subscription } from 'rxjs';
import { interval } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeWhile } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {
  @ViewChild('addProductModal') addProductModal!: ElementRef;
  @ViewChild('editProductModal') editProductModal!: ElementRef;
  @ViewChild('uploadExcelModal') uploadExcelModal!: ElementRef;
   
  private searchSubject = new Subject<string>();
  private addModal: Modal | null = null;
  private editModal: Modal | null = null;
  private uploadModal: Modal | null = null;
  products: Product[] = [];
  environment = environment;
  searchTerm: string = '';
  
  // Separate file handling for add and edit
  selectedAddFile: File | null = null;
  selectedEditFile: File | null = null;
  addImagePreview: string | null = null;
  editImagePreview: string | null = null;
  
  supplierCodeValid: boolean | null = null;

  // Excel upload properties
  selectedExcelFile: File | null = null;
  uploadInProgress: boolean = false;
  uploadProgress: number = 0;
  uploadStatus: string = '';
  currentJobId: string | null = null;
  progressSubscription: Subscription | null = null;
  uploadStats: any = null;
  uploadFailures: any[] = [];

  // Pagination properties
  entriesPerPage: number = 5;
  entriesPerPageOptions: number[] = [5, 10, 20, 50, 100];
  currentPage: number = 1;
  totalPages: number = 0;
  totalItems: number = 0;

  // Pagination object from API
  pagination: any = {
    total: 0,
    per_page: 5,
    current_page: 1,
    last_page: 1,
    from: 0,
    to: 0,
    has_more_pages: false
  };

  // For adding new products
  newProduct: Product = {
    ProductID: 0,
    ProductCode: '',
    ProductName: '',
    SupplierCode: '',
    SupplierID: 0,
    SupplierItemNumber: '',
    SupplierPrice: 0,
    MultiplicationFactor: 0,
    FinalPrice: 0,
    Picture: ''
  };
  
  // For editing existing products
  editedProduct: Product = {
    ProductID: 0,
    ProductCode: '',
    ProductName: '',
    SupplierCode: '',
    SupplierID: 0,
    SupplierItemNumber: '',
    SupplierPrice: 0,
    MultiplicationFactor: 0,
    FinalPrice: 0,
    Picture: ''
  };

  private debounceTimer: any;

  constructor(private productService: ProductService) { }
  
  ngOnInit(): void {
    this.loadProducts();
    // Set up search debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.currentPage = 1;
      this.performSearch();
    });
  }

  loadProducts() {
    const params = { 
      page: this.currentPage, 
      limit: this.entriesPerPage 
    };
    
    this.productService.getProducts(params).subscribe((response: any) => {
      this.products = response.data;
      this.pagination = response.pagination;
      this.totalPages = this.pagination.last_page;
      this.totalItems = this.pagination.total;
      this.currentPage = this.pagination.current_page;
    });
  }

  onSearchChange() {
    this.searchSubject.next(this.searchTerm);
  }

  private performSearch() {
    if (this.searchTerm.trim() === '') {
      this.loadProducts();
    } else {
      this.searchProducts(this.searchTerm);
    }
  }

  searchProducts(searchTerm: string) {
    const params = { 
      page: this.currentPage, 
      limit: this.entriesPerPage 
    };
    
    this.productService.searchProducts(searchTerm, params).subscribe((response: any) => {
      this.products = response.data;
      this.pagination = response.pagination;
      this.totalPages = this.pagination.last_page;
      this.totalItems = this.pagination.total;
      this.currentPage = this.pagination.current_page;
    });
  }

  onEntriesPerPageChange() {
    this.currentPage = 1;
    this.performSearch();
  }

  ngAfterViewInit() {
    if (this.addProductModal) {
      this.addModal = new Modal(this.addProductModal.nativeElement);
    }
    if (this.editProductModal) {
      this.editModal = new Modal(this.editProductModal.nativeElement);
    }
    if (this.uploadExcelModal) {
      this.uploadModal = new Modal(this.uploadExcelModal.nativeElement);
    }
  }

  // Excel upload methods (keeping existing implementation)
  openUploadExcelModal() {
    this.resetUploadState();
    if (this.uploadModal) {
      this.uploadModal.show();
    }
  }

  resetUploadState() {
    this.selectedExcelFile = null;
    this.uploadInProgress = false;
    this.uploadProgress = 0;
    this.uploadStatus = '';
    this.currentJobId = null;
    this.uploadStats = null;
    this.uploadFailures = [];
    
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
      this.progressSubscription = null;
    }
  }

  onExcelFileSelected(event: any) {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExt !== 'xlsx' && fileExt !== 'xls') {
        alert('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }
      
      this.selectedExcelFile = file;
    }
  }

  uploadExcelFile() {
    if (!this.selectedExcelFile) {
      alert('Please select an Excel file first');
      return;
    }
    
    this.uploadInProgress = true;
    this.uploadProgress = 0;
    this.uploadStatus = 'Starting upload...';
    
    const formData = new FormData();
    formData.append('file', this.selectedExcelFile);
    
    this.productService.uploadProductExcel(formData).subscribe({
      next: (response: any) => {
        this.currentJobId = response.jobId;
        this.startProgressTracking();
      },
      error: (error) => {
        console.error('Failed to upload file', error);
        this.uploadStatus = 'Upload failed: ' + (error.error?.message || 'Unknown error');
        this.uploadInProgress = false;
      }
    });
  }

  startProgressTracking() {
    if (!this.currentJobId) return;
    
    this.progressSubscription = interval(2000)
      .pipe(takeWhile(() => this.uploadInProgress && this.uploadProgress < 100))
      .subscribe(() => {
        this.checkUploadProgress();
      });
  }

  checkUploadProgress() {
    if (!this.currentJobId) return;
    
    this.productService.checkUploadProgress(this.currentJobId).subscribe({
      next: (response: any) => {
        this.uploadProgress = response.percentage;
        this.uploadStatus = response.message;
        this.uploadStats = response.stats;
        this.uploadFailures = response.failures || [];
        
        if (response.status === 'completed') {
          this.uploadInProgress = false;
          this.uploadStatus = 'Upload completed successfully';
          alert('Upload completed successfully. ' + this.uploadStats?.total + ' products processed.');
          this.loadProducts();
          if (this.progressSubscription) {
            this.progressSubscription.unsubscribe();
            this.progressSubscription = null;
          }
        } else if (response.status === 'failed' || response.status === 'cancelled') {
          this.uploadInProgress = false;
          if (this.progressSubscription) {
            this.progressSubscription.unsubscribe();
            this.progressSubscription = null;
          }
        }
      },
      error: (error) => {
        console.error('Failed to check upload progress', error);
        this.uploadStatus = 'Error checking progress: ' + (error.error?.message || 'Unknown error');
      }
    });
  }

  cancelUpload() {
    if (!this.currentJobId || !this.uploadInProgress) return;
    
    this.productService.cancelUploading(this.currentJobId).subscribe({
      next: () => {
        this.uploadStatus = 'Upload cancelled';
        this.uploadInProgress = false;
        if (this.progressSubscription) {
          this.progressSubscription.unsubscribe();
          this.progressSubscription = null;
        }
      },
      error: (error: any) => {
        console.error('Failed to cancel upload', error);
        alert('Failed to cancel upload: ' + (error.error?.message || 'Unknown error'));
      }
    });
  }

  // FIXED: Modal and image handling methods
  openAddModal() {
    this.resetProduct();
    this.resetAddImageState();
    if (this.addModal) {
      this.addModal.show();
    }
  }
  
 openEditModal(product: Product) {
  this.editedProduct = { ...product };
  this.resetEditImageState();
  
  // Set initial image preview if product has an image
  if (this.editedProduct.Picture) {
    this.editImagePreview = this.getFullImageUrl(this.editedProduct.Picture);
  }
  
  if (this.editModal) {
    this.editModal.show();
  }
}

  // Helper method to get full image URL
  getFullImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }
    return environment.apiBaseUrl + imagePath;
  }
  
  resetProduct() {
    this.newProduct = {
      ProductID: 0,
      ProductCode: '',
      ProductName: '',
      SupplierID: 0,
      SupplierCode: '',
      SupplierItemNumber: '',
      SupplierPrice: 0,
      MultiplicationFactor: 0,
      FinalPrice: 0,
      Picture: ''
    };
    this.supplierCodeValid = null;
  }

  resetAddImageState() {
    this.selectedAddFile = null;
    this.addImagePreview = null;
  }

  resetEditImageState() {
    this.selectedEditFile = null;
    // this.editImagePreview = null;
  }
  
  // FIXED: Handle Image Upload for Add Product
  onFileSelected(event: any) {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      
      // Validate file type
      if (!file.type.match(/image\/(jpeg|jpg|png|gif)/)) {
        alert('Please select a valid image file (JPEG, PNG, GIF)');
        event.target.value = '';
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        event.target.value = '';
        return;
      }
      
      this.selectedAddFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.addImagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }
  
  // FIXED: Handle Image Upload for Edit Product
onEditFileSelected(event: any) {
  if (event.target.files && event.target.files[0]) {
    const file = event.target.files[0];
    
    // Validate file type
    if (!file.type.match(/image\/(jpeg|jpg|png|gif)/)) {
      alert('Please select a valid image file (JPEG, PNG, GIF)');
      event.target.value = '';
      return;
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      event.target.value = '';
      return;
    }
    
    this.selectedEditFile = file;

    // Create preview for the NEW file
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.editImagePreview = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}
  calculateFinalPrice() {
    if (this.newProduct.SupplierPrice && this.newProduct.MultiplicationFactor) {
      this.newProduct.FinalPrice = this.newProduct.SupplierPrice * this.newProduct.MultiplicationFactor;
    }
  }
calculateEditFinalPrice() {
  if (this.editedProduct.SupplierPrice && this.editedProduct.MultiplicationFactor) {
    this.editedProduct.FinalPrice = this.editedProduct.SupplierPrice * this.editedProduct.MultiplicationFactor;
  }
}
  // Add Product using Product object
  addProduct() {
    if (!this.newProduct.ProductName || !this.newProduct.ProductCode || !this.newProduct.FinalPrice) {
      alert('Please fill all the required fields.');
      return;
    }

    if (this.supplierCodeValid === false) {
      alert('Please enter a valid supplier code.');
      return;
    }

    this.productService.addProduct(this.newProduct).subscribe({
      next: () => {
        alert('Product added successfully.');
        this.loadProducts();
        if (this.addModal) {
          this.addModal.hide();
        }
        this.resetProduct();
        this.resetAddImageState();
      },
      error: (error) => {
        console.error('Error adding product', error);
        alert('Failed to add product: ' + (error.error?.message || 'Please try again.'));
      }
    });
  }
  
  // FIXED: Update Product with proper FormData
  updateProduct() {
    if (!this.editedProduct.ProductName || !this.editedProduct.ProductCode || !this.editedProduct.FinalPrice) {
      alert('Please fill all the required fields.');
      return;
    }
    
    const formData = new FormData();
    
    // Append product data as JSON string
    formData.append('product', JSON.stringify(this.editedProduct));
    
    // Append image file if a new one is selected
    if (this.selectedEditFile) {
      formData.append('image', this.selectedEditFile);
    }
    
    this.productService.updateProduct(formData).subscribe({
      next: (response: any) => {
        alert('Product updated successfully.');
        this.loadProducts();
        if (this.editModal) {
          this.editModal.hide();
        }
        this.resetEditImageState();
      },
      error: (error) => {
        console.error('Error updating product', error);
        alert('Failed to update product: ' + (error.error?.message || 'Please try again.'));
      }
    });
  }
  onProductImageSelected(event: any, productId: number) {
  const file: File = event.target.files?.[0];

  if (!file) return;

  if (!file.type.match(/image\/(jpeg|jpg|png|webp|heic|gif)/)) {
    alert('Invalid file type. Please select a valid image file.');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('Image must be less than 10MB.');
    return;
  }

  const formData = new FormData();
  formData.append('image', file);
  formData.append('productId', productId.toString());

  this.productService.uploadProductImage(productId, formData).subscribe({
    next: () => {
      alert('Image uploaded successfully.');
      this.loadProducts(); // Refresh to show updated image
    },
    error: (err: any) => {
      console.error('Image upload failed', err);
      alert('Failed to upload image. Please try again.');
    }
  });
}


  checkSupplierCode(code: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      if (!code) {
        this.supplierCodeValid = null;
        return;
      }
  
      this.productService.checkSupplierCode(code).subscribe(
        (result: boolean) => {
          this.supplierCodeValid = result;
          if (result) {
            this.productService.getSupplierIdByCode(code).subscribe((id: number) => {
              this.newProduct.SupplierID = id;
            });
          } else {
            this.newProduct.SupplierID = 0;
          }
        },
        error => {
          console.error("Error validating supplier code", error);
          this.supplierCodeValid = false;
        }
      );
    }, 1000);
  }
  
  deleteProduct(productID: number) {
    if (confirm('Are you sure you want to delete this Product?')) {
      this.productService.deleteProduct(productID).subscribe({
        next: () => {
          this.products = this.products.filter(p => p.ProductID !== productID);
          this.totalItems--;
          this.pagination.total--;
          
          if (this.products.length === 0 && this.currentPage > 1) {
            this.currentPage--;
            this.performSearch();
          }
          
          alert('Product deleted successfully.');
        },
        error: (error) => {
          console.error('Error deleting Product', error);
          alert('Failed to delete product. Please try again.');
        }
      });
    }
  }
  
  // Sort Table
  sortColumn: string | null = null;
  sortAscending: boolean = true; 
  sortTable(column: string) {
    if (this.sortColumn === column) {
      this.sortAscending = !this.sortAscending;
    } else {
      this.sortColumn = column;
      this.sortAscending = true;
    }
  
    this.products.sort((a: any, b: any) => {
      let valueA = a[column];
      let valueB = b[column];
  
      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }
  
      if (valueA > valueB) return this.sortAscending ? 1 : -1;
      if (valueA < valueB) return this.sortAscending ? -1 : 1;
      return 0;
    });
  }
  
  // Pagination Methods
  get paginatedProducts() {
    return this.products;
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.performSearch();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.performSearch();
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.performSearch();
    }
  }

  get totalPagesArray() {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get visiblePageNumbers() {
    const maxVisible = 5;
    const current = this.currentPage;
    const total = this.totalPages;
    
    if (total <= maxVisible) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
}