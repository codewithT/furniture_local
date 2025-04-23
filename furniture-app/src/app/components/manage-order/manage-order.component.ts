import { Component, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
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
    RouterModule,
    MatPseudoCheckboxModule,
    MatSelectModule,
  ],
  templateUrl: './manage-order.component.html',
  styleUrls: ['./manage-order.component.css'],
})
export class ManageOrderComponent implements AfterViewInit, OnInit {
  displayedColumns: string[] = ['select', 'SONumber', 'Created_date', 'ProductName', 'CustomerEmail', 'Customer_name','Qty', 'Delivery_date', 'POStatus','Payment_Status', 'action'];
  dataSource = new MatTableDataSource<Order>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  searchTerm: string = '';
  pageSize = 5;
  pageIndex = 0;
  pageSizeOptions: number[] = [5, 10, 15];
  // searchTerm: string = '';
  constructor(private manageOrderService: ManageOrderService, 
    private router: Router, 
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) {}
  
 environment = environment;

  ngOnInit(): void {
    this.fetchOrders();
  }
  fetchOrders(){
    this.manageOrderService.getOrders().subscribe((orders) => {
      this.dataSource.data = orders.map((order : Order) => ({
        ...order,
        Created_date: this.formatDate(order.Created_date),
    Delivery_date: this.formatDate(order.Delivery_date),
        selected: false ,
      }));
    });
  }
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applySearchFilter() {
    const filterValue = this.searchTerm.toLowerCase();
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
  getSelectedOrders(): Order[] {
    const orders =  this.dataSource.data.filter((order: Order) => order.selected);
    console.log(orders);
    return orders;
  }
  updatePaymentStatus(order: Order) {
    console.log("Updated Payment Status:", order.SalesID, order.Payment_Status);
    
    // If you're using an API, send an update request here
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
  

  sendEmailsToCustomers(){
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
  onPageChange(event: any) {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
  }
  toggleAllSelection(event: any) {
    const checked = event.checked;
    this.dataSource.data.forEach(order => order.selected = checked);
  }
  performAction(order: Order) {
    alert('Performing action on Order #${order.SalesID}');
  }
}
