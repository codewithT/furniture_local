// invoice.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvoiceService } from './invoice.service';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
 
@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.css']
})
export class InvoiceComponent implements OnInit {
  // Company details
  companyAddress: string = 'Calgary Furniture Emporium';
  companyContact: string = 'Phone: (555) 123-4567, Email: sales@cfe.com';
  environment = environment;
  // Invoice metadata
  invoiceDate: Date = new Date();
  invoiceNumber: string = '';
  paymentTerms: string = 'Due in 30 days';
  
  // Client details
  billTo = {
    contactName: '',
    companyName: '',
    address: '',
    phone: '',
    email: ''
  };
  
  shipTo = {
    nameDept: '',
    companyName: '',
    address: '',
    phone: ''
  };
  
  // Invoice items
  invoiceItems: any[] = [];
  
  // Totals
  discount: number = 0;
  taxRate: number = 0;
  shippingHandling: number = 0;
  subTotal: number = 0;
  grandTotal: number = 0;
  modeofPayment: string = '';
  paidAmount: number = 0;
  balanceDue: number = 0;
  // Additional info
  notes: string = '';
  
  constructor(
    private invoiceService: InvoiceService,
    private router: Router,
    private route: ActivatedRoute,
    private authService : AuthService
  ) { 
 
    if (!this.authService.isLoggedIn()) {
      this.router.navigate([`/auth/login`]);
    }
  }
 
 // Modify the ngOnInit method in your InvoiceComponent

ngOnInit(): void {
  // Get invoice data from service
  this.invoiceService.getInvoiceData().subscribe(data => {
    if (data) {
      this.populateInvoice(data);
      
      // Check if we should auto-print
      this.route.queryParams.subscribe(params => {
        if (params['print'] === 'true') {
          // Wait for the component to render completely
          setTimeout(() => {
            this.printInvoice();
          }, 500);
        }
      });
    } else {
      // No data available, redirect back to order page
      console.log('No invoice data available');
      // Uncomment to enable redirect when no data is available
      // this.router.navigate(['/add-order']);
    }
  });
}

goToOrders(){
  this.router.navigate([`/u/addOrders`]);
}
  populateInvoice(data: any): void {
    // Update all invoice fields from the data
    this.companyAddress = data.companyAddress || this.companyAddress;
    this.companyContact = data.companyContact || this.companyContact;
    
    this.invoiceDate = data.invoiceDate || this.invoiceDate;
    this.invoiceNumber = data.invoiceNumber || this.invoiceNumber;
    this.paymentTerms = data.paymentTerms || this.paymentTerms;
    
    this.billTo = data.billTo || this.billTo;
    this.shipTo = data.shipTo || this.shipTo;
    
    this.invoiceItems = data.invoiceItems || this.invoiceItems;
    
    this.discount = data.discount || this.discount;
    this.taxRate = data.taxRate || this.taxRate;
    this.shippingHandling = data.shippingHandling || this.shippingHandling;
    this.subTotal = data.subTotal || this.calculateSubtotal();
    this.grandTotal = data.grandTotal || this.calculateBalanceDue();
    this.balanceDue = data.balanceDue || this.calculateBalanceDue();
    this.modeofPayment = data.modeofPayment || this.modeofPayment;
    this.paidAmount = data.paidAmount || this.paidAmount;
    this.notes = data.notes || this.notes;
  }
  
  calculateSubtotal(): number {
    return this.invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }
  
  calculateTax(): number {
    return this.calculateSubtotal() * this.taxRate;
  }
  
  calculateBalanceDue(): number {
    return this.calculateSubtotal() - this.discount + this.calculateTax() + this.shippingHandling;
  }
  
  printInvoice(): void {
    window.print();
  }
}