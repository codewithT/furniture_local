import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { UpdatedInvoiceService } from '../../services/updated-invoice.service';

@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './updated-invoice.component.html',
  styleUrls: ['./updated-invoice.component.css']
})
export class UpdatedInvoiceComponent implements OnInit {
  // Company details
  companyAddress: string = 'Calgary Furniture Emporium';
  companyContact: string = 'Phone: (555) 123-4567, Email: sales@cfe.com';
  environment = environment;

  // Invoice metadata
  invoiceDate: Date = new Date();
  invoiceNumber: string = '';
  soNumber: string = '';
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
  
  // Invoice items with complete details
  invoiceItems: any[] = [];
  
  // Financial details
  subTotal: number = 0;
  discount: number = 0;
  discountPercentage: number = 0;
  isPercentageDiscount: boolean = false;
  taxRate: number = 0;
  gstPercentage: number = 0;
  totalTax: number = 0;
  shippingHandling: number = 0;
  grandTotal: number = 0;
  
  // Payment details
  modeofPayment: string = '';
  otherPaymentDetails: string = '';
  paidAmount: number = 0;
  balanceDue: number = 0;
  paymentStatus: string = '';
  
  // Additional details
  notes: string = '';
  expectedDeliveryDate: string = '';
  poStatus: string = '';
  poNumber: string = '';
  
  // Loading and error states
  isLoading: boolean = true;
  errorMessage: string = '';
  
  constructor(
    private updatedInvoiceService: UpdatedInvoiceService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) { 
    if (!this.authService.isLoggedIn()) {
      this.router.navigate([`/auth/login`]);
      return;
    }
  }

  ngOnInit(): void {
    console.log('Invoice component initialized');
    this.initializeInvoice();
  }

  private initializeInvoice(): void {
    // First check route parameters for SO number
    this.route.params.subscribe(params => {
      console.log('Route params:', params);
      if (params['soNumber']) {
        this.soNumber = params['soNumber'];
        this.generateInvoiceFromSO(this.soNumber);
        return;
      }
      
      // Then check query parameters
      this.route.queryParams.subscribe(queryParams => {
        console.log('Query params:', queryParams);
        if (queryParams['soNumber']) {
          this.soNumber = queryParams['soNumber'];
          this.generateInvoiceFromSO(this.soNumber);
          return;
        }

        // Finally, try to get existing invoice data from service
        this.loadExistingInvoiceData(queryParams);
      });
    });
  }

  private loadExistingInvoiceData(queryParams: any): void {
    this.updatedInvoiceService.getInvoiceData().subscribe({
      next: (data: any) => {
        console.log('Existing invoice data:', data);
        if (data) {
          this.populateInvoice(data);
          this.isLoading = false;
          
          // Check if auto-print is requested
          if (queryParams['print'] === 'true') {
            setTimeout(() => this.printInvoice(), 500);
          }
        } else {
          console.log('No existing invoice data available');
          this.errorMessage = 'No invoice data available. Please select an order first.';
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Error loading existing invoice data:', error);
        this.errorMessage = 'Failed to load invoice data.';
        this.isLoading = false;
      }
    });
  }

  // Generate invoice from SO number
  generateInvoiceFromSO(soNumber: string): void {
    console.log('Generating invoice from SO:', soNumber);
    this.isLoading = true;
    this.errorMessage = '';
    
    this.updatedInvoiceService.generateInvoiceFromSO(soNumber).subscribe({
      next: (invoiceData) => {
        console.log('Invoice generated successfully:', invoiceData);
        if (invoiceData) {
          this.populateInvoice(invoiceData);
          this.isLoading = false;
          
          // Check if auto-print is requested
          this.route.queryParams.subscribe(params => {
            if (params['print'] === 'true') {
              setTimeout(() => this.printInvoice(), 500);
            }
          });
        } else {
          this.errorMessage = 'No data found for the specified SO number.';
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Failed to generate invoice from SO:', error);
        this.errorMessage = 'Failed to load invoice data. Please check the SO number and try again.';
        this.isLoading = false;
      }
    });
  }

  goToOrders() {
    this.router.navigate([`/u/manageOrders`]);
  }

  populateInvoice(data: any): void {
    console.log('Populating invoice with data:', data);
    
    if (!data) {
      console.error('No data provided to populate invoice');
      return;
    }

    try {
      // Company and metadata
      this.companyAddress = data.companyAddress || this.companyAddress;
      this.companyContact = data.companyContact || this.companyContact;
      this.invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
      this.invoiceNumber = data.invoiceNumber || this.invoiceNumber;
      this.soNumber = data.soNumber || this.soNumber;
      this.paymentTerms = data.paymentTerms || this.paymentTerms;
      
      // Customer details - ensure we have objects
      this.billTo = {
        contactName: data.billTo?.contactName || '',
        companyName: data.billTo?.companyName || '',
        address: data.billTo?.address || '',
        phone: data.billTo?.phone || '',
        email: data.billTo?.email || ''
      };
      
      this.shipTo = {
        nameDept: data.shipTo?.nameDept || '',
        companyName: data.shipTo?.companyName || '',
        address: data.shipTo?.address || '',
        phone: data.shipTo?.phone || ''
      };
      
      // Items - ensure it's an array
      this.invoiceItems = Array.isArray(data.invoiceItems) ? data.invoiceItems : [];
      
      // Financial data - convert to numbers
      this.subTotal = this.safeParseFloat(data.subTotal);
      this.discount = this.safeParseFloat(data.discount);
      this.discountPercentage = this.safeParseFloat(data.discountPercentage);
      this.isPercentageDiscount = Boolean(data.isPercentageDiscount);
      this.taxRate = this.safeParseFloat(data.taxRate);
      this.gstPercentage = this.safeParseFloat(data.gstPercentage);
      this.totalTax = this.safeParseFloat(data.totalTax);
      this.shippingHandling = this.safeParseFloat(data.shippingHandling);
      this.grandTotal = this.safeParseFloat(data.grandTotal);
      
      // Payment details
      this.modeofPayment = data.modeofPayment || '';
      this.otherPaymentDetails = data.otherPaymentDetails || '';
      this.paidAmount = this.safeParseFloat(data.paidAmount);
      this.balanceDue = this.safeParseFloat(data.dueAmount) || (this.grandTotal - this.paidAmount);
      this.paymentStatus = data.paymentStatus || '';
      
      // Additional details
      this.notes = data.notes || '';
      this.expectedDeliveryDate = data.expectedDeliveryDate || '';
      this.poStatus = data.poStatus || '';
      this.poNumber = data.poNumber || '';
      
      // Recalculate tax if not provided
      if (this.totalTax === 0 && this.taxRate > 0) {
        this.totalTax = (this.subTotal - this.discount) * this.taxRate;
      }
      
      console.log('Invoice populated successfully');
      this.verifyCalculations();
      
    } catch (error) {
      console.error('Error populating invoice:', error);
      this.errorMessage = 'Error processing invoice data.';
    }
  }

  private safeParseFloat(value: any): number {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  // Helper method to verify calculations match order data
  private verifyCalculations(): void {
    const calculatedSubTotal = this.calculateSubtotal();
    const calculatedTax = this.calculateTax();
    const calculatedGrandTotal = this.calculateGrandTotal();
    const calculatedBalance = this.grandTotal - this.paidAmount;
    
    console.log('Calculation verification:', {
      subtotal: { calculated: calculatedSubTotal, provided: this.subTotal },
      tax: { calculated: calculatedTax, provided: this.totalTax },
      grandTotal: { calculated: calculatedGrandTotal, provided: this.grandTotal },
      balance: { calculated: calculatedBalance, provided: this.balanceDue }
    });
    
    // Log any significant discrepancies
    if (Math.abs(calculatedSubTotal - this.subTotal) > 0.01) {
      console.warn('Subtotal mismatch:', { calculated: calculatedSubTotal, provided: this.subTotal });
    }
    if (Math.abs(calculatedGrandTotal - this.grandTotal) > 0.01) {
      console.warn('Grand total mismatch:', { calculated: calculatedGrandTotal, provided: this.grandTotal });
    }
  }
  
  // Calculation methods
  calculateSubtotal(): number {
    return this.invoiceItems.reduce((sum, item) => {
      const quantity = this.safeParseFloat(item.quantity);
      const unitPrice = this.safeParseFloat(item.unitPrice);
      return sum + (quantity * unitPrice);
    }, 0);
  }
  
  calculateTax(): number {
    return (this.subTotal - this.discount) * this.taxRate;
  }
  
  calculateGrandTotal(): number {
    return this.subTotal - this.discount + this.totalTax + this.shippingHandling;
  }
  
  // Utility methods for template
  getDiscountDisplay(): string {
    if (this.isPercentageDiscount && this.discountPercentage > 0) {
      return `${this.discountPercentage}% (${this.discount.toFixed(2)})`;
    }
    return this.discount.toFixed(2);
  }
  
  getTaxDisplay(): string {
    return `${this.gstPercentage}% GST`;
  }
  
  getPaymentDisplay(): string {
    let display = this.modeofPayment;
    if (this.modeofPayment === 'Others' && this.otherPaymentDetails) {
      display += ` (${this.otherPaymentDetails})`;
    }
    return display;
  }
  
  printInvoice(): void {
    window.print();
  }

  // Helper method for debugging in template
  debugData(): void {
    console.log('Current component data:', {
      invoiceItems: this.invoiceItems,
      billTo: this.billTo,
      shipTo: this.shipTo,
      financials: {
        subTotal: this.subTotal,
        discount: this.discount,
        totalTax: this.totalTax,
        grandTotal: this.grandTotal
      }
    });
  }
}