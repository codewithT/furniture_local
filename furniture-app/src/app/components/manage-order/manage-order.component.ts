import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ManageOrderService } from '../../services/manageOrders.service';
import { Order } from '../../models/order.model';
import { ShowOrderDetailsComponent } from '../show-order-details/show-order-details.component';
import { environment } from '../../../environments/environment';
import { UtcToLocalPipe } from '../../pipes/utc-to-local.pipe';
import { DateUtilityService } from '../../services/date-utility.service';

@Component({
  selector: 'app-manage-order',
  standalone: true,
  imports: [CommonModule, FormsModule, UtcToLocalPipe],
  providers: [DateUtilityService],
  templateUrl: './manage-order.component.html',
  styleUrls: ['./manage-order.component.css'],
})
export class ManageOrderComponent implements OnInit {
  orders: Order[] = [];
  searchTerm: string = '';
  currentPage: number = 1;
  pageSize: number = 10;
  pageSizeOptions: number[] = [10, 20, 30, 50, 100];
  totalItems: number = 0;
  isLoading = false;
  
  // Sorting properties
  sortColumn: keyof Order | '' = 'Created_date';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  environment = environment;

  constructor(
    private manageOrderService: ManageOrderService, 
    private router: Router, 
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  /**
   * Close all dropdowns when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    this.closeAllDropdowns();
  }

  loadOrders() {
    this.isLoading = true;
    
    // Build sort parameters
    const sortBy = this.sortColumn || 'Created_date';
    const sortOrder = this.sortDirection || 'desc';
    
    const params = {
      page: this.currentPage,
      limit: this.pageSize,
      search: this.searchTerm.trim(),
      sortField: sortBy,
      sortOrder: sortOrder
    };

    console.log('📡 Fetching orders with params:', params);

    this.manageOrderService.getOrders(params).subscribe({
      next: (response) => {
        console.log('✅ Orders received:', response);
        
        this.orders = response.data.map((order: Order) => ({
          ...order,
          selected: false,
        }));
        
        this.totalItems = response.totalRecords;
        this.isLoading = false;
        this.cdr.detectChanges();
        
        console.log('📊 Data updated:', {
          totalRecords: this.totalItems,
          dataLength: this.orders.length,
          currentSort: { field: sortBy, order: sortOrder }
        });
      },
      error: (error) => {
        console.error('❌ Error fetching orders:', error);
        this.isLoading = false;
      }
    });
  }

  searchOrders() {
    this.currentPage = 1; // Reset to first page when searching
    this.loadOrders();
  }

  onPageSizeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) {
      this.pageSize = Number(target.value);
      this.currentPage = 1; // Reset to first page
      this.loadOrders();
    }
  }

  decrementPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadOrders();
      this.cdr.detectChanges();
    }
  }

  incrementPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadOrders();
      this.cdr.detectChanges();
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  getSelectedOrders(): Order[] {
    const selectedOrders = this.orders.filter((order: Order) => order.selected);
    console.log(selectedOrders);
    return selectedOrders;
  }

  updatePaymentStatus(order: Order) {
    console.log("Updated Payment Status:", order.SalesID, order.Payment_Status);
    
    this.manageOrderService.updateOrder(order)
      .subscribe(response => {
        console.log("Payment status updated successfully!", response);
        alert('Payment status updated');
      }, error => {
        console.error("Error updating payment status", error);
      });
  }

  toggleSelectAll(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.orders.forEach(order => {
      order.selected = isChecked;
    });
  }

  sortTable(column: keyof Order) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.currentPage = 1; // Reset to first page when sorting
    this.loadOrders();
  }

  isSortedBy(columnName: keyof Order): boolean {
    return this.sortColumn === columnName;
  }

  getSortIcon(columnName: keyof Order): string {
    if (this.sortColumn === columnName) {
      return this.sortDirection === 'asc' ? '▲' : '▼';
    }
    return '';
  }

  /**
   * Toggle dropdown for a specific order
   */
  toggleDropdown(order: Order, event: Event) {
    event.stopPropagation();
    // Close all other dropdowns
    this.orders.forEach(o => {
      if (o !== order) {
        o.dropdownOpen = false;
      }
    });
    // Toggle the clicked dropdown
    order.dropdownOpen = !order.dropdownOpen;
  }

  /**
   * Close dropdown for a specific order
   */
  closeDropdown(order: Order) {
    order.dropdownOpen = false;
  }

  /**
   * Close all dropdowns when clicking outside
   */
  closeAllDropdowns() {
    this.orders.forEach(o => {
      o.dropdownOpen = false;
    });
  }

  showSaleDetails(order: Order) {
    if (order && order.SONumber) {
      this.router.navigate([`/u/order-details/${order.SONumber}`]);
    } else {
      console.error('Invalid order or missing soNumber');
    }
  }

  removeOrder(order: Order) {
    if (confirm(`Are you sure you want to delete order ${order.SONumber}?`)) {
      this.manageOrderService.removeOrder(order).subscribe({
        next: () => {
          console.log(`Order ${order.SalesID} deleted successfully.`);
          alert(`Order ${order.SONumber} deleted successfully.`);
          this.loadOrders(); // Refresh order list
        },
        error: (err) => {
          console.error('Error deleting order:', err);
          alert('Failed to delete order!');
        }
      });
    }
  }

  /**
   * Send payment reminders to customers for selected orders
   */
  sendPaymentReminders() {
    const selectedOrders = this.getSelectedOrders();
    if (selectedOrders.length === 0) {
      alert('No orders selected!');
      return;
    }

    this.manageOrderService.sendPaymentReminders(selectedOrders).subscribe({
      next: () => alert('Payment reminders sent successfully!'),
      error: (err) => {
        console.error('Error sending payment reminders:', err);
        alert('Failed to send payment reminders!');
      }
    });
  }

  sendEmailsToCustomers() {
    const selectedOrders = this.getSelectedOrders();
    console.log(selectedOrders);
    if (selectedOrders.length === 0) {
      alert("No orders selected!");
      return;
    }
    this.manageOrderService.sendMails(selectedOrders).subscribe(
      (response) => {
        alert("Emails sent successfully!");
      },
      (error) => {
        console.error("Error sending email:", error);
        alert("Failed to send emails!");
      }
    );
  }

  /**
   * Data source getter for compatibility
   */
  get dataSource() {
    return {
      data: this.orders
    };
  }
}