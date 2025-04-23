import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
 
import { Modal } from 'bootstrap';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';
 
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
  
  private addModal: Modal | null = null;
  private editModal: Modal | null = null;

  products: Product[] = [];
 
  searchTerm: string = '';
  selectedFile: File | null = null;
  supplierCodeValid: boolean | null = null;

  // Pagination properties
  entriesPerPage: number = 5;
  currentPage: number = 1;
  
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
  }
  
  loadProducts() {
    this.productService.getProducts().subscribe((data: Product[]) => {
      this.products = data;
      this.updatePagination();
    });
  }
  
  ngAfterViewInit() {
    if (this.addProductModal) {
      this.addModal = new Modal(this.addProductModal.nativeElement);
    }
    if (this.editProductModal) {
      this.editModal = new Modal(this.editProductModal.nativeElement);
    }
  }
  
  // Open Add Product Modal
  openAddModal() {
    this.resetProduct();
    if (this.addModal) {
      this.addModal.show();
    }
  }
  
  // Open Edit Product Modal
  openEditModal(product: Product) {
    if (product.Picture === null) {
      product.Picture = '';
    }
    
    // Create a deep copy to avoid modifying the original object
    this.editedProduct = { ...product };
    
    if (this.editModal) {
      this.editModal.show();
    }
  }
  
  // Reset Product form
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
  }
  
  // Handle Image Upload for Add Product
  onFileSelected(event: any) {
    if (event.target.files && event.target.files[0]) {
      this.selectedFile = event.target.files[0];

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.newProduct.Picture = e.target.result; // Store image as base64
      };
      if (this.selectedFile) {
        reader.readAsDataURL(this.selectedFile);
      } else {
        alert('Select an image');
      }
    }
  }
  
  // Handle Image Upload for Edit Product
  onEditFileSelected(event: any) {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.editedProduct.Picture = e.target.result; // Store image as base64
      };
      reader.readAsDataURL(file);
    }
  }

  // Calculate Final Price based on Supplier Price and Multiplication Factor
  calculateFinalPrice() {
    if (this.newProduct.SupplierPrice && this.newProduct.MultiplicationFactor) {
      this.newProduct.FinalPrice = this.newProduct.SupplierPrice * this.newProduct.MultiplicationFactor;
    }
  }

  // Add Product
  addProduct() {
    if (!this.newProduct.ProductName || !this.newProduct.ProductCode || !this.newProduct.FinalPrice) {
      alert('Please fill all the required fields.');
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
      },
      error: (error) => {
        console.error('Error adding product', error);
        alert('Failed to add product. Please try again.');
      }
    });
  }
  
  // Update Product
  updateProduct() {
    if (!this.editedProduct.ProductName || !this.editedProduct.ProductCode || !this.editedProduct.FinalPrice) {
      alert('Please fill all the required fields.');
      return;
    }
    console.log('Updating product:', this.editedProduct);
    this.productService.updateProduct(this.editedProduct).subscribe({
      next: () => {
        alert('Product updated successfully.');
        this.loadProducts();
        if (this.editModal) {
          this.editModal.hide();
        }
      },
      error: (error) => {
        console.error('Error updating product', error);
        alert('Failed to update product. Please try again.');
      }
    });
  }

  // Debounce Supplier Code Validation
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
            // If valid, get the SupplierID and assign it
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
    }, 3000); // 500ms debounce time
  }
  
  // Delete Product
  deleteProduct(productID: number) {
    if (confirm('Are you sure you want to delete this Product?')) {
      this.productService.deleteProduct(productID).subscribe({
        next: () => {
          this.products = this.products.filter(p => p.ProductID !== productID);
          this.updatePagination();
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

  // Search Filter
  get filteredProducts() {
    return this.products.filter(product =>
      product.ProductName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      product.ProductCode.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }
  
  onSearchTermChange() {
    this.updatePagination();
  }
  
  // Pagination Methods
  get totalPages() {
    return Math.ceil(this.filteredProducts.length / this.entriesPerPage);
  }

  get paginatedProducts() {
    const start = (this.currentPage - 1) * this.entriesPerPage;
    return this.filteredProducts.slice(start, start + this.entriesPerPage);
  }

  get startItem() {
    return (this.currentPage - 1) * this.entriesPerPage;
  }

  get endItem() {
    return Math.min(this.startItem + this.entriesPerPage, this.filteredProducts.length);
  }

  updatePagination() {
    const total = Math.ceil(this.filteredProducts.length / this.entriesPerPage);
    if (this.currentPage > total) {
      this.currentPage = Math.max(1, total);
    }
  }
  
  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPage(page: number) {
    this.currentPage = page;
  }

  get totalPagesArray() {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
}
