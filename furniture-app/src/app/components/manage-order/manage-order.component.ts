import { Component, ViewChild, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ManageOrderService } from '../../services/manageOrders.service';
import { MatPseudoCheckboxModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Order } from '../../models/order.model';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { ShowOrderDetailsComponent } from '../show-order-details/show-order-details.component';
import { environment } from '../../../environments/environment';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import { UtcToLocalPipe } from '../../pipes/utc-to-local.pipe';
import { DateUtilityService } from '../../services/date-utility.service';

@Component({
  selector: 'app-manage-order',
  standalone: true,
  imports: [
    MatTableModule, 
    MatPaginatorModule, 
    MatSortModule, 
    MatButtonModule, 
    MatInputModule, 
    CommonModule, 
    FormsModule,
    MatCheckboxModule,
    MatMenuModule,
    MatIconModule,
    MatPseudoCheckboxModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    UtcToLocalPipe,
  ],
  providers: [DateUtilityService],
  templateUrl: './manage-order.component.html',
  styleUrls: ['./manage-order.component.css'],
})
export class ManageOrderComponent implements AfterViewInit, OnInit, OnDestroy {
  displayedColumns: string[] = ['select', 'SONumber', 'Created_date', 'ProductName', 'CustomerEmail', 'Customer_name','Qty', 
    'Delivery_date', 'SOStatus','Total_Paid_Amount','Payment_Status', 'action'];
  dataSource = new MatTableDataSource<Order>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Pagination properties
  searchTerm: string = '';
  pageSize = 5;
  pageIndex = 0;
  totalRecords = 0;
  pageSizeOptions: number[] = [5, 10, 20, 50, 100];
  sortField = 'Created_date';
  sortOrder = 'desc';
  isLoading = false;
  
  environment = environment;
  
  // Subscription management
  private sortSubscription?: Subscription;

  constructor(
    private manageOrderService: ManageOrderService, 
    private router: Router, 
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.fetchOrders();
  }

  ngAfterViewInit() {
    // Wait for the view to initialize completely
    setTimeout(() => {
      this.setupSorting();
    }, 0);
  }

  private setupSorting(): void {
    if (!this.sort) {
      console.error('MatSort not found!');
      return;
    }

    // Assign the sort to dataSource (required for visual indicators)
    this.dataSource.sort = this.sort;
    
    // Set initial sort state
    this.sort.active = this.sortField;
    this.sort.direction = this.sortOrder as 'asc' | 'desc';
    
    console.log('Initial sort setup:', { active: this.sort.active, direction: this.sort.direction });
    
    // Clean up any existing subscription
    if (this.sortSubscription) {
      this.sortSubscription.unsubscribe();
    }
    
    // Set up sort change listener for server-side sorting
    this.sortSubscription = this.sort.sortChange.subscribe((sortState: Sort) => {
      console.log('🔄 Sort change event triggered:', sortState);
      
      // Reset to first page when sorting
      this.pageIndex = 0;
      
      // Map the column header to the actual database field name
      const mappedField = this.mapSortField(sortState.active);
      const newSortOrder = sortState.direction || 'desc';
      
      console.log('🔍 Sort mapping:', {
        clicked: sortState.active,
        mapped: mappedField,
        direction: newSortOrder,
        oldField: this.sortField,
        oldOrder: this.sortOrder
      });
      
      // Only fetch if something actually changed
      if (this.sortField !== mappedField || this.sortOrder !== newSortOrder) {
        this.sortField = mappedField;
        this.sortOrder = newSortOrder;
        
        console.log('✅ Fetching orders with new sort:', {
          field: this.sortField,
          order: this.sortOrder
        });
        
        this.fetchOrders();
      } else {
        console.log('⚠️ Sort values unchanged, skipping fetch');
      }
    });

    // Override the default sorting behavior to prevent client-side sorting
    this.dataSource.sortingDataAccessor = () => '';
    this.dataSource.sortData = (data: Order[]) => {
      console.log('🚫 Client-side sorting disabled - returning original data');
      return data;
    };
    
    console.log('✅ Sort setup completed');
  }


  ngOnDestroy(): void {
    // Clean up subscription
    if (this.sortSubscription) {
      this.sortSubscription.unsubscribe();
    }
  }

  /**
   * Map frontend column names to backend database field names
   */
  private mapSortField(columnName: string): string {
    const fieldMapping: { [key: string]: string } = {
      'SONumber': 'SONumber',
      'Created_date': 'Created_date',
      'ProductName': 'ProductName',
      'CustomerEmail': 'CustomerEmail',
      'Customer_name': 'Customer_name',
      'Qty': 'Qty',
      'Delivery_date': 'Delivery_date',
      'SOStatus': 'SOStatus',
      'Total_Paid_Amount': 'Total_Paid_Amount',
      'Payment_Status': 'Payment_Status'
    };
    
    return fieldMapping[columnName] || 'Created_date'; // Default to Created_date if mapping not found
  }

  fetchOrders() {
    this.isLoading = true;
    
    const params = {
      page: this.pageIndex + 1, // Backend expects 1-based page numbers
      limit: this.pageSize,
      search: this.searchTerm.trim(),
      sortField: this.sortField,
      sortOrder: this.sortOrder
    };

    console.log('📡 Fetching orders with params:', params);
    console.log('🌐 Full URL would be:', `${this.manageOrderService['apiUrl']}?page=${params.page}&limit=${params.limit}&search=${params.search}&sortField=${params.sortField}&sortOrder=${params.sortOrder}`);

    this.manageOrderService.getOrders(params).subscribe({
      next: (response) => {
        console.log('✅ Orders received:', response);
        
        this.dataSource.data = response.data.map((order: Order) => ({
          ...order,
          Created_date: this.formatDate(order.Created_date),
          Delivery_date: this.formatDate(order.Delivery_date),
          selected: false,
        }));
        
        this.totalRecords = response.totalRecords;
        this.isLoading = false;
        
        console.log('📊 Data updated:', {
          totalRecords: this.totalRecords,
          dataLength: this.dataSource.data.length,
          currentSort: { field: this.sortField, order: this.sortOrder }
        });
      },
      error: (error) => {
        console.error('❌ Error fetching orders:', error);
        this.isLoading = false;
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  }

  applySearchFilter() {
    this.pageIndex = 0; // Reset to first page when searching
    this.fetchOrders();
  }

  onPageChange(event: PageEvent) {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.fetchOrders();
  }

  getSelectedOrders(): Order[] {
    const orders = this.dataSource.data.filter((order: Order) => order.selected);
    console.log(orders);
    return orders;
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
  
  showOrderDetails(order: Order): void {
    this.dialog.open(ShowOrderDetailsComponent, {
      width: '1000px',
      data: order
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
          this.fetchOrders(); // Refresh order list
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

  toggleAllSelection(event: any) {
    const checked = event.checked;
    this.dataSource.data.forEach(order => order.selected = checked);
  }

  performAction(order: Order) {
    alert(`Performing action on Order #${order.SalesID}`);
  }
}