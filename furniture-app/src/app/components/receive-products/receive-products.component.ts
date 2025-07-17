import { Component, OnInit } from '@angular/core';
import { ReceiveProductsService, ReceivedProduct } from '../../services/receive-products.service';
import { HttpClient } from '@angular/common/http';    
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-receive-products',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './receive-products.component.html',
  styleUrls: ['./receive-products.component.css']
})
export class ReceiveProductsComponent implements OnInit {
  receiveProducts: ReceivedProduct[] = [];
  Math = Math;  
  itemsPerPageOptions: number[] = [10, 50, 100, 200];
  itemsPerPage = 10;
  currentPage = 1;
  totalItems = 0;
  totalPages = 0;
  pages: number[] = [];
  sortField: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
    searchQuery: string = '';
  constructor(private receiveProductsService: ReceiveProductsService) {}

  ngOnInit(): void {
    this.loadReceivedProducts();
  }

   loadReceivedProducts(): void {
    this.receiveProductsService.getReceivedProducts(
      this.currentPage, 
      this.itemsPerPage,
      this.searchQuery,
      this.sortField,
      this.sortDirection
    ).subscribe({
      next: (res) => {
        this.receiveProducts = res.data;
        this.totalItems = res.totalItems;
        this.totalPages = res.totalPages;
        this.currentPage = res.currentPage;
        this.updatePages();
      },
      error: (error) => console.error('Error fetching received products', error)
    });
  }
  sortTable(field: string): void {
    if (this.sortField === field) {
      // If same field, toggle direction
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // If different field, set new field and default to ascending
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1; // Reset to first page when sorting
    this.loadReceivedProducts();
  }
  getSortIcon(field: string): string {
    if (this.sortField !== field) {
      return 'sort'; // Default sort icon
    }
    return this.sortDirection === 'asc' ? 'sort-up' : 'sort-down';
  }
    
  // searchProducts(): void {
  //   if (this.searchQuery.trim()) {
  //     this.receiveProductsService.getReceivedProducts(this.currentPage, this.itemsPerPage).subscribe({
  //       next: (res) => {
  //         this.receiveProducts = res.data.filter(product =>
  //           product.SupplierCode.includes(this.searchQuery) ||
  //           product.PONumber.includes(this.searchQuery) ||
  //           product.ProductName.includes(this.searchQuery)
  //         );
  //         this.totalItems = this.receiveProducts.length;
  //         this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
  //         this.currentPage = 1;
  //         this.updatePages();
  //       },
  //       error: (error) => console.error('Error searching products', error)
  //     });
  //   } else {
  //     this.loadReceivedProducts();
  //   }
  // }

   changeItemsPerPage(event: any) {
    this.itemsPerPage = +event.target.value;
    this.currentPage = 1;
    this.loadReceivedProducts(); // This will now include search and sort parameters
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadReceivedProducts();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadReceivedProducts();
    }
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.loadReceivedProducts();
  }

  updatePages() {
    const visibleRange = 5;
    const half = Math.floor(visibleRange / 2);
    let start = Math.max(this.currentPage - half, 1);
    let end = Math.min(start + visibleRange - 1, this.totalPages);

    if (end - start < visibleRange - 1) {
      start = Math.max(end - visibleRange + 1, 1);
    }

    this.pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  updateStatus(product: any) {
    this.receiveProductsService.updateStatus(product).subscribe({
      next: (response: any) => {
        alert('Status updated successfully');
        console.log('Status updated successfully', response);
        this.loadReceivedProducts();
      },
      error: (error) => console.error('Error updating status', error)
    });
  }

  printDetails(received: ReceivedProduct): void {
    const printContent = `
      <h2>Product Receiving Details</h2>
      <p><strong>SO Number:</strong> ${received.SONumber || 'N/A'}</p>
      <p><strong>Customer Name:</strong> ${received.Customer_name || 'N/A'}</p>
      <p><strong>Customer Address:</strong> ${received.ShipToParty || 'N/A'}</p>
    `;
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(printContent);
      newWindow.document.close();
      newWindow.print();
    }
  }
}
