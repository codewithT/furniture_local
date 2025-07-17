import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PurchaseService } from '../../services/purchase.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { ShowToSupplierService } from '../../services/showToSupplier.service';

@Component({
  selector: 'app-show-to-supplier',
  standalone: true,
  imports: [FormsModule, CommonModule, MatTableModule],
  templateUrl: './show-to-supplier.component.html',
  styleUrls: ['./show-to-supplier.component.css']
})
export class ShowToSupplierComponent implements OnInit {
  purchases: any[] = [];
  confirmations: { [key: string]: { status: string, delayedDate?: string } } = {};
  loading = false;
  supplierEmail: string = '';
  displayedColumns: string[] = ['PONumber', 'ProductCode', 'Qty','ProductName', 'Supplier_Date', 'Confirm'];
  successMessage: string = ''; 
  
  constructor(private route: ActivatedRoute, private purchaseService: PurchaseService,
    private showToSupplierService: ShowToSupplierService
  ) {}
  
  email: string  = '';
  
  ngOnInit(): void {
    // Get email from the URL and decode it
    this.email = decodeURIComponent(this.route.snapshot.paramMap.get('email') || '');
    console.log('Decoded email:', this.email);
    this.route.params.subscribe(params => {
      this.supplierEmail = decodeURIComponent(params['email']); // Decode the email
      if (this.supplierEmail) {
        this.fetchPurchases();
      }
    });
  }
  
  fetchPurchases(): void {
    this.loading = true;
    console.log(this.supplierEmail);
    this.showToSupplierService.getPurchaseOrders(this.supplierEmail).subscribe(
      (data: any) => {
        this.purchases = data || []; // Ensure it's always an array
        
        // Initialize confirmations object for each purchase
        this.purchases.forEach(purchase => {
          this.confirmations[purchase.PurchaseID] = { status: '' };
        });
        
        this.loading = false;
      },
      (error) => {
        console.error('Error fetching purchase orders:', error);
        this.purchases = []; // Set empty array on error
        this.loading = false;
      }
    );
  }

  checkDelayed(purchaseID: string): void {
    if (this.confirmations[purchaseID]?.status !== 'DELAYED') {
      delete this.confirmations[purchaseID]?.delayedDate; // Remove date if not delayed
    }
  }
  
  submitConfirmations(): void {
    this.loading = true;
    
    // Send the confirmations object directly without converting to array
    this.showToSupplierService.sendConfirmations(this.supplierEmail, this.confirmations).subscribe(
      (data) => {
        alert('Confirmations sent successfully!');
        this.successMessage = 'Order confirmations sent successfully!';
        this.loading = false;
        this.confirmations = {}; 
      },
      (error) => {
        console.error('Error sending confirmations:', error);
        alert('Failed to send confirmations.');
        this.loading = false;
      }
    );
  }
  isSubmitDisabled(): boolean {
  return Object.keys(this.confirmations).some(
    id => !this.confirmations[id].status ||
         (this.confirmations[id].status === 'DELAYED' && !this.confirmations[id].delayedDate)
  );
}

}