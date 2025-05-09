import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AddOrderService } from '../../services/addOrder.service';
import { AuthService } from '../../services/auth.service';
import { InvoiceService } from '../invoice/invoice.service';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';

@Component({
  selector: 'app-add-order',
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  standalone: true,
  templateUrl: './add-order.component.html',
  styleUrls: ['./add-order.component.css']
})
export class AddOrderComponent implements OnInit {
  orderForm!: FormGroup;
  environment = environment;
  
  // Product search related properties
  productSearchTerms: { [index: number]: Subject<string> } = {};
  productSuggestions: { [index: number]: any[] } = {};
  showProductSuggestions: { [index: number]: boolean } = {};
  suppressBlur: boolean = false; // New flag to control blur behavior
  
  constructor(private fb: FormBuilder,
    private addOrderService: AddOrderService,
    private authService: AuthService,
    private invoiceService: InvoiceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  getFutureDate(days: number): string {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return futureDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  }
  
  initializeForm() {
    this.orderForm = this.fb.group({
      clientEmail: ['', [Validators.required, Validators.minLength(3)]],
      customerName: ['', [Validators.required,]],
      clientContact: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      items: this.fb.array([]),
      subAmount: [{ value: 0, disabled: true }],
      totalAmount: [{ value: 0, disabled: true }],
      grandTotal: [0, Validators.required],
      gst: [0, Validators.required],
      discount: [0],
      paymentStatus: ['', Validators.required],
      shipToParty: [''],
      internalNote: [''],
      expectedDeliveryDate: [this.getFutureDate(21), Validators.required],
      paymentMode: ['', Validators.required],
      otherPaymentDetails: [{ value: '', disabled: true }],
      paidAmount: [0, Validators.required],
      dueAmount: [{ value: 0, disabled: true }],
    });
     
    this.orderForm.get('paymentMode')?.valueChanges.subscribe(value => {
      if (value === 'Others') {
        this.orderForm.get('otherPaymentDetails')?.enable();
      } else {
        this.orderForm.get('otherPaymentDetails')?.disable();
        this.orderForm.get('otherPaymentDetails')?.setValue('');
      }
    });
    this.addItem();
    this.setupFormListeners();
  }

  get items(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }
  
  supplierCodes: { [index: number]: any[] } = {}; // Store supplier codes per row
  storeProductSupplierIdCodes: any[] = []; // Store the final product data
   
  addItem() {
    const index = this.items.length; // Track index for each row
    this.supplierCodes[index] = [];
    this.productSuggestions[index] = [];
    this.showProductSuggestions[index] = false;
    this.productSearchTerms[index] = new Subject<string>();
    
    const item = this.fb.group({
      selected: [false],
      SupplierCode: ['', Validators.required],
      ProductCode: ['', Validators.required],
      ProductName: ['', [Validators.required]],
      rate: [0, [Validators.required, Validators.min(1)]],
      quantity: [1, [Validators.required, Validators.min(1)]],
      total: [{ value: 0, disabled: true }]
    });

    // Setup product search with debounce
    this.productSearchTerms[index].pipe(
      debounceTime(10), // Wait 300ms after each keystroke
      distinctUntilChanged(), // Ignore if same as previous
      switchMap(term => this.addOrderService.searchProductsByCode(term))
    ).subscribe(products => {
      this.productSuggestions[index] = products;
      this.showProductSuggestions[index] = products.length > 0;
    });

    // Product code change handler
    item.get('ProductCode')?.valueChanges.subscribe((productCode) => {
      if (productCode && productCode.length >= 3) {
        this.productSearchTerms[index].next(productCode);
      } else {
        this.showProductSuggestions[index] = false;
      }
    });

    // Rate change handler
    item.get('rate')?.valueChanges.subscribe((rate) => {
      const qty = item.get('quantity')?.value ?? 0;
      rate = rate ?? 0;
      const total = rate * qty;
      
      if (item.get('total')?.value !== total) {
        item.get('total')?.setValue(total, { emitEvent: false });
      }
      
      this.updateStoredProduct(index, { rate, total });
      this.updateSubAmount();
    });

    // Quantity change handler
    item.get('quantity')?.valueChanges.subscribe((qty) => {
      const rate = item.get('rate')?.value ?? 0;
      qty = qty ?? 1;
      const total = rate * qty;
      
      if (item.get('total')?.value !== total) {
        item.get('total')?.setValue(total, { emitEvent: false });
      }

      this.updateStoredProduct(index, { quantity: qty, total });
      this.updateSubAmount();
    });
    
    this.items.push(item);
  }
 
  updateStoredProduct(index: number, updates: Partial<{ rate: number; quantity: number; total: number }>) {
    // Find the stored product by index
    const productIndex = this.storeProductSupplierIdCodes.findIndex(item => item.index === index);
    
    if (productIndex === -1) {
      return; // Product not found, likely not selected a supplier yet
    }
  
    // Update the product with new values
    this.storeProductSupplierIdCodes[productIndex] = { 
      ...this.storeProductSupplierIdCodes[productIndex], 
      ...updates 
    };
    
    console.log("Updated product at index", index, this.storeProductSupplierIdCodes[productIndex]);
  }
  
  handleSupplierSelect(event: Event, index: number) {
    const selectedSupplierCode = (event.target as HTMLSelectElement).value;
    const selectedSupplier = this.supplierCodes[index].find(s => s.SupplierCode === selectedSupplierCode);
    
    if (!selectedSupplier) {
      console.error("Selected supplier not found");
      return;
    }
    
    console.log("Selected supplier:", selectedSupplier);
    
    // Get the form item values
    const item = this.items.at(index).getRawValue();
    
    // Get product ID from API
    this.addOrderService.getProductID(selectedSupplier.ProductCode, selectedSupplier.SupplierID)
      .subscribe(
        (data: any) => {
          console.log("Selected Product data:", data);
          
          if (data && data.ProductID) {
            // Check if this product+supplier already exists in our array
            const existingIndex = this.storeProductSupplierIdCodes.findIndex(
              prod => prod.index === index
            );
           
            this.items.at(index).get('ProductName')?.setValue(data.ProductName);
            this.items.at(index).get('rate')?.setValue(data.FinalPrice);

            const productData = {
              SupplierID: selectedSupplier.SupplierID,
              SupplierCode: selectedSupplier.SupplierCode,
              ProductCode: selectedSupplier.ProductCode,
              ProductName: data.ProductName,
              ProductID: data.ProductID,
              Check: item.selected || false,
              index: index,
              quantity: item.quantity || 0,
              rate: data.FinalPrice || 0,
              total: item.total || 0
            };
            
            if (existingIndex !== -1) {
              // Update existing entry
              this.storeProductSupplierIdCodes[existingIndex] = productData;
            } else {
              this.storeProductSupplierIdCodes.push(productData);
            }
            
            console.log("Updated product storage:", this.storeProductSupplierIdCodes);
          }
        },
        (error) => {
          console.error('Error fetching Product ID:', error);
        }
      );
  }

  // New method to handle mouse down on suggestion
  onProductSuggestionMouseDown() {
    this.suppressBlur = true;
    
    // Reset the flag after a short delay
    setTimeout(() => {
      this.suppressBlur = false;
    }, 200);
  }

  // New method to handle product suggestion selection
  selectProductSuggestion(product: any, index: number) {
    // Reset the suppressBlur flag
    this.suppressBlur = false;

    // Hide suggestions immediately
    this.showProductSuggestions[index] = false;
    
    const itemControl = this.items.at(index);
    itemControl.get('ProductCode')?.setValue(product.ProductCode);
    
    // Fetch supplier codes for this product code
    this.addOrderService.getSupplierCodesByProductCode(product.ProductCode).subscribe(
      (data: any[]) => {
        if (data && data.length) {
          // Update supplier codes for this row
          this.supplierCodes[index] = data.map(supplier => ({
            SupplierID: supplier.SupplierID,
            SupplierCode: supplier.SupplierCode,
            ProductCode: product.ProductCode,
          }));
          
          console.log(`Supplier codes for row ${index}:`, this.supplierCodes[index]);
          
          // If there's only one supplier, select it automatically
          if (this.supplierCodes[index].length === 1) {
            itemControl.get('SupplierCode')?.setValue(this.supplierCodes[index][0].SupplierCode);
            
            // Simulate the change event to populate product details
            const event = {
              target: { value: this.supplierCodes[index][0].SupplierCode }
            } as unknown as Event;
            this.handleSupplierSelect(event, index);
          }
        }
      },
      (error) => {
        console.error('Error fetching supplier codes:', error);
      }
    );
  }
  
  // Hide suggestions when clicking outside, but check suppressBlur flag
  hideProductSuggestions(index: number) {
    if (!this.suppressBlur) {
      setTimeout(() => {
        this.showProductSuggestions[index] = false;
      }, 200);
    }
  }
  
  log() {
    console.log("Stored items:", this.storeProductSupplierIdCodes);
  }
  
  onCheckboxChange(index: number, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
  
    // Find the product by index
    const itemIndex = this.storeProductSupplierIdCodes.findIndex(item => item.index === index);
  
    if (itemIndex !== -1) {
      // Update the Check property
      this.storeProductSupplierIdCodes[itemIndex].Check = isChecked;
      console.log("Updated product check status:", this.storeProductSupplierIdCodes[itemIndex]);
    }
  }

  removeItem(index: number) {
    this.items.removeAt(index);
    
    // Remove the corresponding product from storage
    const itemIndex = this.storeProductSupplierIdCodes.findIndex(item => item.index === index);
    if (itemIndex !== -1) {
      this.storeProductSupplierIdCodes.splice(itemIndex, 1);
    }
    
    // Clean up related resources
    delete this.supplierCodes[index];
    delete this.productSuggestions[index];
    delete this.showProductSuggestions[index];
    delete this.productSearchTerms[index];
    
    this.updateSubAmount();
  }

  setupFormListeners() {
    this.orderForm.get('gst')?.valueChanges.subscribe(() => this.updateGrandTotal());
    this.orderForm.get('discount')?.valueChanges.subscribe(() => this.updateGrandTotal());
    this.orderForm.get('paidAmount')?.valueChanges.subscribe(() => this.updateGrandTotal());
  }
  
  updateSubAmount() {
    const subTotal = this.items.controls.reduce((sum, item) => sum + (item.get('total')?.value || 0), 0);
    this.orderForm.get('subAmount')?.setValue(subTotal);
    this.updateGrandTotal();
  }

  updateGrandTotal() {
    const subTotal = this.orderForm.get('subAmount')?.value || 0;
    const gstPercentage = this.orderForm.get('gst')?.value || 0;
    const discount = this.orderForm.get('discount')?.value || 0;
    const paidAmount = this.orderForm.get('paidAmount')?.value || 0;
  
    const gst = subTotal * (gstPercentage * 0.01);
    const grandTotal = parseFloat((subTotal + gst - discount).toFixed(2));
    const dueAmount = parseFloat((grandTotal - paidAmount).toFixed(2));
  
    if (this.orderForm.get('grandTotal')?.value !== grandTotal) {
      this.orderForm.get('grandTotal')?.setValue(grandTotal, { emitEvent: false });
    }
  
    if (this.orderForm.get('dueAmount')?.value !== dueAmount) {
      this.orderForm.get('dueAmount')?.setValue(dueAmount, { emitEvent: false });
    }
  }
  
  generateInvoice() {
    if (this.orderForm.valid) {
      const orderData = this.orderForm.getRawValue();
      const currentDate = new Date();
      
      // Format order items for invoice
      const invoiceItems = this.storeProductSupplierIdCodes.map(item => ({
        quantity: item.quantity || 0,
        description: item.ProductName || '',
        unitPrice: item.rate || 0,
        total: item.total || 0
      }));

      // Create invoice data object
      const invoiceData = {
        // Company details
        companyAddress: 'Calgary Furniture Emporium',
        companyContact: 'Phone: (555) 123-4567, Email: sales@cfe.com',
        
        // Invoice metadata
        invoiceDate: currentDate,
        invoiceNumber: 'INV-' + Math.floor(Math.random() * 10000),
        paymentTerms: orderData.paymentStatus === 'Full Paid' ? 'Paid in Full' : 'Due in 30 days',
        
        // Client details
        billTo: {
          contactName: orderData.customerName || '',
          companyName: orderData.customerName,
          address: orderData.ShipToParty,
          phone: orderData.clientContact || '',
          email: orderData.clientEmail || ''
        },
        
        shipTo: {
          nameDept: orderData.customerName || '',
          companyName: '',
          address: orderData.shipToParty || '',
          phone: orderData.clientContact || '',
        },
        
        // Invoice items
        invoiceItems: invoiceItems,
        
        // Totals
        discount: orderData.discount || 0,
        taxRate: orderData.gst / 100 || 0,
        shippingHandling: 0,
        subTotal: orderData.subAmount || 0,
        grandTotal: orderData.grandTotal || 0,
        modeofPayment: orderData.paymentMode || '',
        otherPaymentDetails: orderData.otherPaymentDetails || '',
        paidAmount: orderData.paidAmount || 0,
        dueAmount: orderData.dueAmount || 0,
        // Additional info
        notes: orderData.internalNote || ''
      };

      // Send to invoice service
      this.invoiceService.setInvoiceData(invoiceData);
      
      // Navigate to invoice page
      // this.router.navigate(['/invoice']);
    } else {
      alert('Please fill all required fields correctly before generating invoice.');
    }
  }
  
  // checking place order 
  placeOrderCheck: boolean = false;
  submitOrder() {
    this.placeOrderCheck = true;
    if (this.orderForm.valid) {
      console.log('Order Submitted:', this.orderForm.getRawValue());
      const orderData = this.orderForm.getRawValue();
      
      // Prepare items for API
      const ItemsData = this.storeProductSupplierIdCodes.map(item => ({
        ProductID: item.ProductID || null,
        SupplierID: item.SupplierID || null,
        ProductCode: item.ProductCode || '',
        SupplierCode: item.SupplierCode || '',
        Qty: item.quantity || 0,
        Price: item.rate || 0,
        TotalPrice: (item.quantity || 0) * (item.rate || 0),
        Check: item.Check || false,
      }));
  
      // Final data to send
      const finalData = {
        Created_by: this.authService.getCurrentUser(),
        Delivery_date: orderData.expectedDeliveryDate || '',
        POStatus: orderData.POStatus || 'Not Ordered',
        PONumber: orderData.PONumber || '',
        CustomerEmail: orderData.clientEmail || '',
        Customer_name: orderData.customerName || '', 
        Customer_Contact: orderData.clientContact || '',
        GST: orderData.gst || 0,
        ShipToParty: orderData.shipToParty || '',
        InternalNote: orderData.internalNote || '',
        Payment_Status: orderData.paymentStatus,
        Payment_Mode: orderData.paymentMode || '',
        items: ItemsData
      };
  
      // Call API
      this.addOrderService.submitCheckedOrder(finalData).subscribe(
        (response) => {
          console.log('Order response:', response);
          alert(`Order placed successfully with Sale Order Number: ${response.SONumber}`);
        },
        (error) => {
          console.error('Error submitting order:', error);
        }
      );
    } else {
      alert('Please fill all required fields correctly.');
    }
  }

  printInvoice() {
    if(!this.placeOrderCheck) {
      alert('Please place the order before generating an invoice.');
      return;
    }
    this.placeOrderCheck = false;
    if (this.orderForm.valid) {
      // First generate the invoice data
      this.generateInvoice();
      
      // Then navigate to invoice page and trigger print
      this.router.navigate([`/u/invoice`], { 
        queryParams: { 
          print: 'true' 
        }
      });
    } else {
      alert('Please fill all required fields correctly before generating an invoice.');
    }
  }
}