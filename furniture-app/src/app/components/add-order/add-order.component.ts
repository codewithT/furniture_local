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
  suppressBlur: boolean = false;
  
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
    return futureDate.toISOString().split('T')[0];
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
    gst: [5, Validators.required],
    // Updated discount fields to match the HTML template
    isPercentageDiscount: [false], // UI toggle for discount type
    discountFlat: [0], // Flat discount amount in dollars
    discountPercentage: [0], // Percentage discount
    calculatedDiscountAmount: [{ value: 0, disabled: true }], // Calculated discount amount (read-only)
    discount: [0], // Final calculated discount amount (stored in DB)
    
    paymentStatus: ['', Validators.required],
    shipToParty: [''],
    internalNote: [''],
    expectedDeliveryDate: [this.getFutureDate(21), Validators.required],
    paymentMode: ['', Validators.required],
    otherPaymentDetails: [{ value: '', disabled: true }],
    paidAmount: [0, Validators.required],
    dueAmount: [{ value: 0, disabled: true }],
    soldToParty: [''], 
  });
   
  // Existing payment mode listener
  this.orderForm.get('paymentMode')?.valueChanges.subscribe(value => {
    if (value === 'Others') {
      this.orderForm.get('otherPaymentDetails')?.enable();
    } else {
      this.orderForm.get('otherPaymentDetails')?.disable();
      this.orderForm.get('otherPaymentDetails')?.setValue('');
    }
  });

  // Discount type toggle listener
  this.orderForm.get('isPercentageDiscount')?.valueChanges.subscribe(() => {
    this.calculateDiscount();
  });

  // Discount flat amount listener
  this.orderForm.get('discountFlat')?.valueChanges.subscribe(() => {
    this.calculateDiscount();
  });

  // Discount percentage listener
  this.orderForm.get('discountPercentage')?.valueChanges.subscribe(() => {
    this.calculateDiscount();
  });
  
  this.addItem();
  this.setupFormListeners();
}

  // Calculate final discount amount from UI inputs
 calculateDiscount() {
  const isPercentage = this.orderForm.get('isPercentageDiscount')?.value;
  const discountFlat = this.orderForm.get('discountFlat')?.value || 0;
  const discountPercentage = this.orderForm.get('discountPercentage')?.value || 0;
  const subTotal = this.orderForm.get('subAmount')?.value || 0;
  
  let finalDiscountAmount = 0;

  if (isPercentage) {
    // Calculate percentage discount
    finalDiscountAmount = (subTotal * discountPercentage) / 100;
  } else {
    // Use flat discount amount
    finalDiscountAmount = discountFlat;
  }

  // Update the calculated discount amount (display field)
  this.orderForm.get('calculatedDiscountAmount')?.setValue(finalDiscountAmount, { emitEvent: false });
  
  // Update the main discount field (this goes to database)
  this.orderForm.get('discount')?.setValue(finalDiscountAmount, { emitEvent: false });
  
  // Trigger grand total recalculation
  this.updateGrandTotal();
}

  preventEnterKey(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.preventDefault();
  }

  get items(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }
  
  supplierCodes: { [index: number]: any[] } = {};
  storeProductSupplierIdCodes: any[] = [];
   
  addItem() {
    const index = this.items.length;
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
      debounceTime(300),
      distinctUntilChanged(),
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
        if (!productCode) {
          this.clearProductData(index);
        }
      }
    });

    // Rate change handler
    item.get('rate')?.valueChanges.subscribe((rate) => {
      const qty = item.get('quantity')?.value ?? 0;
      rate = rate ?? 0;
      const total = rate * qty;
      
      item.get('total')?.setValue(total, { emitEvent: false });
      this.updateStoredProduct(index, { rate, total });
      this.updateSubAmount();
    });

    // Quantity change handler
    item.get('quantity')?.valueChanges.subscribe((qty) => {
      const rate = item.get('rate')?.value ?? 0;
      qty = qty ?? 1;
      const total = rate * qty;
      
      item.get('total')?.setValue(total, { emitEvent: false });
      this.updateStoredProduct(index, { quantity: qty, total });
      this.updateSubAmount();
    });
    
    this.items.push(item);
  }
 
  updateStoredProduct(index: number, updates: Partial<{ rate: number; quantity: number; total: number }>) {
    const productIndex = this.storeProductSupplierIdCodes.findIndex(item => item.index === index);
    
    if (productIndex === -1) {
      return;
    }
  
    this.storeProductSupplierIdCodes[productIndex] = { 
      ...this.storeProductSupplierIdCodes[productIndex], 
      ...updates 
    };
    
    console.log("Updated product at index", index, this.storeProductSupplierIdCodes[productIndex]);
  }

  clearProductData(index: number) {
    const item = this.items.at(index);
    item.get('ProductName')?.setValue('');
    item.get('rate')?.setValue(0);
    item.get('SupplierCode')?.setValue('');
    
    this.supplierCodes[index] = [];
    
    const productIndex = this.storeProductSupplierIdCodes.findIndex(item => item.index === index);
    if (productIndex !== -1) {
      this.storeProductSupplierIdCodes.splice(productIndex, 1);
    }
    
    this.updateSubAmount();
  }
  
  handleSupplierSelect(event: Event, index: number) {
    const selectedSupplierCode = (event.target as HTMLSelectElement).value;
    
    if (!selectedSupplierCode) {
      this.clearSupplierData(index);
      return;
    }
    
    const selectedSupplier = this.supplierCodes[index].find(s => s.SupplierCode === selectedSupplierCode);
    
    if (!selectedSupplier) {
      console.error("Selected supplier not found");
      return;
    }
    
    console.log("Selected supplier:", selectedSupplier);
    
    const item = this.items.at(index).getRawValue();
    
    this.addOrderService.getProductID(selectedSupplier.ProductCode, selectedSupplier.SupplierID)
      .subscribe(
        (data: any) => {
          console.log("Selected Product data:", data);
          
          if (data && data.length > 0 && data[0].ProductID) {
            const productData = data[0];
            
            this.items.at(index).get('ProductName')?.setValue(productData.ProductName);
            this.items.at(index).get('rate')?.setValue(productData.FinalPrice);

            const existingIndex = this.storeProductSupplierIdCodes.findIndex(
              prod => prod.index === index
            );

            const productStorageData = {
              SupplierID: selectedSupplier.SupplierID,
              SupplierCode: selectedSupplier.SupplierCode,
              ProductCode: selectedSupplier.ProductCode,
              ProductName: productData.ProductName,
              ProductID: productData.ProductID,
              Check: item.selected || false,
              index: index,
              quantity: item.quantity || 1,
              rate: productData.FinalPrice || 0,
              total: (item.quantity || 1) * (productData.FinalPrice || 0)
            };
            
            if (existingIndex !== -1) {
              this.storeProductSupplierIdCodes[existingIndex] = productStorageData;
            } else {
              this.storeProductSupplierIdCodes.push(productStorageData);
            }
            
            this.items.at(index).get('total')?.setValue(productStorageData.total);
            this.updateSubAmount();
            
            console.log("Updated product storage:", this.storeProductSupplierIdCodes);
          }
        },
        (error) => {
          console.error('Error fetching Product ID:', error);
        }
      );
  }

  clearSupplierData(index: number) {
    const item = this.items.at(index);
    item.get('ProductName')?.setValue('');
    item.get('rate')?.setValue(0);
    
    const productIndex = this.storeProductSupplierIdCodes.findIndex(item => item.index === index);
    if (productIndex !== -1) {
      this.storeProductSupplierIdCodes.splice(productIndex, 1);
    }
    
    this.updateSubAmount();
  }

  onProductSuggestionMouseDown() {
    this.suppressBlur = true;
    setTimeout(() => {
      this.suppressBlur = false;
    }, 200);
  }

  selectProductSuggestion(product: any, index: number) {
    this.suppressBlur = false;
    this.showProductSuggestions[index] = false;
    
    const itemControl = this.items.at(index);
    itemControl.get('ProductCode')?.setValue(product.ProductCode);
    
    this.addOrderService.getSupplierCodesByProductCode(product.ProductCode).subscribe(
      (data: any[]) => {
        if (data && data.length) {
          this.supplierCodes[index] = data.map(supplier => ({
            SupplierID: supplier.SupplierID,
            SupplierCode: supplier.SupplierCode,
            ProductCode: product.ProductCode,
          }));
          
          console.log(`Supplier codes for row ${index}:`, this.supplierCodes[index]);
          
          if (this.supplierCodes[index].length === 1) {
            itemControl.get('SupplierCode')?.setValue(this.supplierCodes[index][0].SupplierCode);
            
            const event = {
              target: { value: this.supplierCodes[index][0].SupplierCode }
            } as unknown as Event;
            this.handleSupplierSelect(event, index);
          }
        } else {
          this.clearProductData(index);
        }
      },
      (error) => {
        console.error('Error fetching supplier codes:', error);
        this.clearProductData(index);
      }
    );
  }
  
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
    
    this.items.at(index).get('selected')?.setValue(isChecked);
  
    const itemIndex = this.storeProductSupplierIdCodes.findIndex(item => item.index === index);
    if (itemIndex !== -1) {
      this.storeProductSupplierIdCodes[itemIndex].Check = isChecked;
      console.log("Updated product check status:", this.storeProductSupplierIdCodes[itemIndex]);
    }
  }

  removeItem(index: number) {
    this.items.removeAt(index);
    
    const itemIndex = this.storeProductSupplierIdCodes.findIndex(item => item.index === index);
    if (itemIndex !== -1) {
      this.storeProductSupplierIdCodes.splice(itemIndex, 1);
    }
    
    delete this.supplierCodes[index];
    delete this.productSuggestions[index];
    delete this.showProductSuggestions[index];
    if (this.productSearchTerms[index]) {
      this.productSearchTerms[index].complete();
      delete this.productSearchTerms[index];
    }
    
    this.reindexItems(index);
    this.updateSubAmount();
  }

  reindexItems(removedIndex: number) {
    this.storeProductSupplierIdCodes.forEach(item => {
      if (item.index > removedIndex) {
        item.index--;
      }
    });

    const newSupplierCodes: { [index: number]: any[] } = {};
    const newProductSuggestions: { [index: number]: any[] } = {};
    const newShowProductSuggestions: { [index: number]: boolean } = {};
    const newProductSearchTerms: { [index: number]: Subject<string> } = {};

    Object.keys(this.supplierCodes).forEach(key => {
      const numKey = parseInt(key);
      if (numKey < removedIndex) {
        newSupplierCodes[numKey] = this.supplierCodes[numKey];
        newProductSuggestions[numKey] = this.productSuggestions[numKey];
        newShowProductSuggestions[numKey] = this.showProductSuggestions[numKey];
        newProductSearchTerms[numKey] = this.productSearchTerms[numKey];
      } else if (numKey > removedIndex) {
        newSupplierCodes[numKey - 1] = this.supplierCodes[numKey];
        newProductSuggestions[numKey - 1] = this.productSuggestions[numKey];
        newShowProductSuggestions[numKey - 1] = this.showProductSuggestions[numKey];
        newProductSearchTerms[numKey - 1] = this.productSearchTerms[numKey];
      }
    });

    this.supplierCodes = newSupplierCodes;
    this.productSuggestions = newProductSuggestions;
    this.showProductSuggestions = newShowProductSuggestions;
    this.productSearchTerms = newProductSearchTerms;
  }

  setupFormListeners() {
    this.orderForm.get('gst')?.valueChanges.subscribe(() => this.updateGrandTotal());
    this.orderForm.get('discount')?.valueChanges.subscribe(() => this.updateGrandTotal());
    this.orderForm.get('paidAmount')?.valueChanges.subscribe(() => this.updateGrandTotal());
  }
  
  updateSubAmount() {
    const subTotal = this.items.controls.reduce((sum, item) => sum + (item.get('total')?.value || 0), 0);
    this.orderForm.get('subAmount')?.setValue(subTotal);
    this.orderForm.get('totalAmount')?.setValue(subTotal);
    
    // Recalculate discount when subtotal changes (important for percentage discounts)
    this.calculateDiscount();
  }

  // Keep the existing updateGrandTotal method unchanged
  updateGrandTotal() {
    const subTotal = this.orderForm.get('subAmount')?.value || 0;
    const gstPercentage = this.orderForm.get('gst')?.value || 0;
    const discount = this.orderForm.get('discount')?.value || 0;
    const paidAmount = this.orderForm.get('paidAmount')?.value || 0;

    // Step 1: Apply discount on subtotal
    const discountedAmount = subTotal - discount;

    // Step 2: Apply GST on discounted amount
    const gst = discountedAmount * (gstPercentage * 0.01);

    // Step 3: Final amount = discounted amount + gst
    const grandTotal = parseFloat((discountedAmount + gst).toFixed(2));

    // Step 4: Due amount
    const dueAmount = parseFloat((grandTotal - paidAmount).toFixed(2));

    this.orderForm.get('grandTotal')?.setValue(grandTotal, { emitEvent: false });
    this.orderForm.get('dueAmount')?.setValue(dueAmount, { emitEvent: false });
  }
  
  generateInvoice() {
    if (this.orderForm.valid) {
      const orderData = this.orderForm.getRawValue();
      const currentDate = new Date();
      
      const invoiceItems = this.storeProductSupplierIdCodes.map(item => ({
        quantity: item.quantity || 0,
        description: item.ProductName || '',
        unitPrice: item.rate || 0,
        total: item.total || 0
      }));

      const invoiceData = {
        companyAddress: 'Calgary Furniture Emporium',
        companyContact: 'Phone: (555) 123-4567, Email: sales@cfe.com',
        
        invoiceDate: currentDate,
        invoiceNumber: 'INV-' + Math.floor(Math.random() * 10000),
        paymentTerms: orderData.paymentStatus === 'Full Paid' ? 'Paid in Full' : 'Due in 30 days',
        
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
        
        invoiceItems: invoiceItems,
        
        discount: orderData.discount || 0,
        taxRate: orderData.gst / 100 || 0,
        shippingHandling: 0,
        subTotal: orderData.subAmount || 0,
        grandTotal: orderData.grandTotal || 0,
        modeofPayment: orderData.paymentMode || '',
        otherPaymentDetails: orderData.otherPaymentDetails || '',
        paidAmount: orderData.paidAmount || 0,
        dueAmount: orderData.dueAmount || 0,
        notes: orderData.internalNote || ''
      };

      this.invoiceService.setInvoiceData(invoiceData);
    } else {
      alert('Please fill all required fields correctly before generating invoice.');
    }
  }
  
  placeOrderCheck: boolean = false;
  // Method to convert 'YYYY-MM-DD' to UTC date string
convertLocalDateToUTC(dateString: string): string {
  const localDate = new Date(dateString); // e.g., '2025-07-25'
  return localDate.toISOString(); // e.g., '2025-07-24T18:30:00.000Z'
}
 

submitOrder() {
  this.placeOrderCheck = true;
  if (this.orderForm.valid) {
    console.log('Order Submitted:', this.orderForm.getRawValue());
    const orderData = this.orderForm.getRawValue();
    
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
      // Convert local date string (YYYY-MM-DD) to UTC ISO string
    let deliveryDateUTC = '';
    if (orderData.expectedDeliveryDate) {
      const localDate = new Date(orderData.expectedDeliveryDate); // interpreted as local midnight
      deliveryDateUTC = localDate.toISOString(); // converts to UTC (e.g., '2025-07-24T18:30:00.000Z')
    }
    // Determine payment mode and payment details
    let finalPaymentMode = orderData.paymentMode || '';
    let paymentDetails = '';
    
    if (orderData.paymentMode === 'Others') {
      paymentDetails = orderData.otherPaymentDetails || '';
    }

    const finalData = {
      Created_by: this.authService.getCurrentUser(),
      Delivery_date: deliveryDateUTC || '',
      POStatus: orderData.POStatus || 'Not Ordered',
      PONumber: orderData.PONumber || '',
      CustomerEmail: orderData.clientEmail || '',
      Customer_name: orderData.customerName || '', 
      Customer_Contact: orderData.clientContact || '',
      GST: orderData.gst || 0,
      SubTotal: orderData.subAmount || 0,
      DiscountAmount: orderData.discount || 0,  // Send the calculated discount amount
      GrandTotal: orderData.grandTotal || 0,
      DueAmount: orderData.dueAmount || 0,
      PaymentDetails: paymentDetails,  // Send other payment details separately
      ShipToParty: orderData.shipToParty || '',
      SoldToParty: orderData.soldToParty || '',  // Added sold to party
      InternalNote: orderData.internalNote || '',
      Payment_Status: orderData.paymentStatus || '',
      Payment_Mode: finalPaymentMode,  // Send the selected payment mode
      Total_Paid_Amount: orderData.paidAmount || 0,
      items: ItemsData
    };

    console.log('Final data being sent to API:', finalData);

    this.addOrderService.submitCheckedOrder(finalData).subscribe(
      (response) => {
        console.log('Order response:', response);
        alert(`Order placed successfully with Sale Order Number: ${response.SONumber}`);
      },
      (error) => {
        console.error('Error submitting order:', error);
        alert('Error placing order. Please try again.');
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
      this.generateInvoice();
      
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