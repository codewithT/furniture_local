import { CommonModule } from '@angular/common';
import { Component, numberAttribute, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AddOrderService } from '../../services/addOrder.service';
import { AuthService } from '../../services/auth.service';
import { InvoiceService } from '../invoice/invoice.service';
import { environment } from '../../../environments/environment';
@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './order-details.component.html',
  styleUrls: ['./order-details.component.css']
})
export class OrderDetailsComponent implements OnInit {
  orderForm!: FormGroup;
  environment = environment;
  orderId: string = '';
  isLoading: boolean = true;
  orderData: any = null;
  soNumber : string  = '';
  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private orderService: AddOrderService,
    private authService: AuthService,
    private invoiceService: InvoiceService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    
    // Get order ID from route params or query params
    this.route.params.subscribe(params => {
      if (params['soNumber']) {
        this.soNumber = params['soNumber'];
        this.fetchOrderDetails();
      }
    });
    
    if (!this.soNumber) {
      this.route.queryParams.subscribe(params => {
        if (params['order']) {
          this.soNumber = params['order'];
          this.fetchOrderDetails();
        } else {
          this.isLoading = false;
        }
      });
    }
    
  }

  initializeForm(): void {
    this.orderForm = this.fb.group({
      clientEmail: [{ value: '', disabled: true }],
      customerName: [{ value: '', disabled: true }],
      items: this.fb.array([]),
      subAmount: [{ value: 0, disabled: true }],
      gst: [{ value: 0, disabled: true }],
      discount: [{ value: 0, disabled: true }],
      grandTotal: [{ value: 0, disabled: true }],
      paymentStatus: [{ value: '', disabled: false }],
      shipToParty: [{ value: '', disabled: false }],
      internalNote: [{ value: '', disabled: false }],
      expectedDeliveryDate: [{ value: '', disabled: false }],
      poStatus: [{ value: '', disabled: true }],
      poNumber: [{ value: '', disabled: true }],
      createdBy: [{ value: '', disabled: true }],
      createdDate: [{ value: '', disabled: true }],
      paymentMode: [{ value: '', disabled: false }],
      clientContact: [{ value: '', disabled: true }],
      paidAmount: [{ value: 0, disabled: false }],
      dueAmount: [{ value: 0, disabled: true }],
      soldToParty: [{ value: '', disabled: false }],
    });
  }

  get items(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }

  fetchOrderDetails(): void {
    this.isLoading = true;
    
    this.orderService.getOrderById(this.soNumber).subscribe(
      (data) => {
        console.log(data);
        this.orderData = data;
        console.log('Order Data:', this.orderData);
        this.populateForm(data);
        this.isLoading = false;
      },
      (error) => {
        console.error('Error fetching order details:', error);
        this.isLoading = false;
      }
    );
  }

  populateForm(data: any): void {
    // Clear existing items
    while (this.items.length) {
      this.items.removeAt(0);
    }
    
    // Set basic order info
    this.orderForm.patchValue({
      clientEmail: data.CustomerEmail || '',
      customerName: data.Customer_name || '',
      gst: data.GST || 0,
      discount: data.Discount || 0,
      grandTotal: data.GrandTotal || 0,
      paymentStatus: data.Payment_Status || '',
      shipToParty: data.ShipToParty || '',
      internalNote: data.InternalNote || '',
      expectedDeliveryDate: this.formatDate(data.Delivery_date),
      poStatus: data.POStatus || '',
      poNumber: data.PONumber || '',
      createdBy: data.Created_by || '',
      createdDate: this.formatDate(data.Created_at),
      paymentMode: data.Payment_Mode || '',
      clientContact: data.Customer_Contact || '',
      paidAmount: data.Total_Paid_Amount || 0,
      soldToParty: data.SoldToParty || ''
    });
    
    // Add order items
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item: any) => {
        this.addItem(item);
      });
    }
    
    // Calculate subtotal
    this.calculateSubTotal();
  }
  
  addItem(item: any): void {
    const itemGroup = this.fb.group({
      supplierCode: [{ value: item.SupplierCode || '', disabled: true }],
      productCode: [{ value: item.ProductCode || '', disabled: true }],
      productName: [{ value: item.ProductName || '', disabled: true }],
      price: [{ value: item.Price || 0, disabled: true }],
      quantity: [{ value: item.Qty || 0, disabled: true }],
      total: [{ value: (item.Price * item.Qty) || 0, disabled: true }]
    });
    
    this.items.push(itemGroup);
  }
  
calculateSubTotal(): void {
  let subTotal = 0;

  for (let i = 0; i < this.items.length; i++) {
    const item = this.items.at(i);
    const price = item.get('price')?.value || 0;
    const quantity = item.get('quantity')?.value || 0;
    subTotal += price * quantity;
  }

  const gst = this.orderForm.get('gst')?.value || 0;
  const discount = this.orderForm.get('discount')?.value || 0;
  const paidAmount = this.orderForm.get('paidAmount')?.value || 0;

  // Calculate grand total
  const grandTotal = subTotal + (gst * subTotal) / 100 - discount;

  // Round to 2 decimal places
  const roundedSubTotal = parseFloat(subTotal.toFixed(2));
  const roundedGrandTotal = parseFloat(grandTotal.toFixed(2));
  const dueAmount = parseFloat((roundedGrandTotal - paidAmount).toFixed(2));

  this.orderForm.patchValue({
    subAmount: roundedSubTotal,
    grandTotal: roundedGrandTotal,
    dueAmount: dueAmount
  });
}


  
  formatDate(dateString: string | null): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    } catch (e) {
      return '';
    }
  }
  
  printInvoice(): void {
    if (!this.orderData) return;
    
    // Format items for invoice
    const invoiceItems = this.orderData.items.map((item: any) => ({
      quantity: item.Qty || 0,
      description: item.ProductName || '',
      unitPrice: item.Price || 0,
      total: (item.Price * item.Qty) || 0
    }));
    
    // Create invoice data
    const invoiceData = {
      // Company details
      companyAddress: 'Calgary Furniture Emporium',
      companyContact: 'Phone: (555) 123-4567, Email: sales@cfe.com',
      
      // Invoice metadata
      invoiceDate: new Date(this.orderData.Created_at) || new Date(),
      invoiceNumber: `INV-${this.orderData.OrderID}`,
      paymentTerms: this.orderData.Payment_Status === 'Full Paid' ? 'Paid in Full' : 'Due in 30 days',
      
      // Client details
      billTo: {
        contactName: this.orderData.Customer_name || '',
        companyName: this.orderData.Customer_name || '',
        address: this.orderData.ShipToParty || '',
        phone: '',
        email: this.orderData.CustomerEmail || ''
      },
      
      shipTo: {
        nameDept: this.orderData.Customer_name || '',
        companyName: '',
        address: this.orderData.ShipToParty || '',
        phone: ''
      },
      
      invoiceItems: invoiceItems,
      
      discount: this.orderData.Discount || 0,
      taxRate: (this.orderData.GST || 0) / 100,
      shippingHandling: 0,
      subTotal: this.orderForm.get('subAmount')?.value || 0,
      grandTotal: this.orderData.GrandTotal || 0,
      
      notes: this.orderData.InternalNote || ''
    };
    
    // Send to invoice service
    this.invoiceService.setInvoiceData(invoiceData);
    
    // Navigate to invoice with print parameter
    this.router.navigate(['/u/invoice'], { 
      queryParams: { print: 'true' } 
    });
  }

  // goBack(): void {
  //   this.router.navigate([`/u/manage-orders`], { });
  // }

  submitOrder(): void {
    if (this.orderForm.valid) {
      console.log("Order submitted:", this.orderForm.value);
      // Add API call or further processing here
      this.orderService.updateOrder(this.soNumber, this.orderForm.value).subscribe(
        (response) => {
          console.log('Order updated successfully:', response);
          alert('Order updated successfully!');
          // this.router.navigate(['/u/manage-orders']);
        },
        (error) => {
          console.error('Error updating order:', error);
          alert('Failed to update order. Please try again.');
        }
      );
    }
  }

}