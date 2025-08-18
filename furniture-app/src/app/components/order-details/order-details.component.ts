import { CommonModule, formatDate } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AddOrderService } from '../../services/addOrder.service';
import { AuthService } from '../../services/auth.service';
 
import { ManageOrderService } from '../../services/manageOrders.service';
import { OrderDetailsService } from '../../services/orderDetails.service';
import { environment } from '../../../environments/environment';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { UpdatedInvoiceService } from '../../services/updated-invoice.service';

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
  soNumber: string = '';
  // --- Adapted AddOrderComponent logic ---
  productSearchTerms: { [index: number]: Subject<string> } = {};
  productSuggestions: { [index: number]: any[] } = {};
  showProductSuggestions: { [index: number]: boolean } = {};
  suppressBlur: boolean = false;
  supplierCodes: { [index: number]: any[] } = {};
  storeProductSupplierIdCodes: any[] = [];
  // placeOrderCheck: boolean = false; // <-- REMOVED: This flag was causing the issue.

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private orderService: AddOrderService,
    private authService: AuthService,
     private updatedInvoiceService: UpdatedInvoiceService,
    private manageOrderService: ManageOrderService,
    private orderDetailsService: OrderDetailsService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
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
      clientEmail: ['', [Validators.required, Validators.minLength(3)]],
      customerName: ['', [Validators.required]],
      clientContact: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      items: this.fb.array([]),
      subAmount: [{ value: 0, disabled: true }],
      totalAmount: [{ value: 0, disabled: true }],
      grandTotal: [0, Validators.required],
      gst: [5, Validators.required],
      isPercentageDiscount: [false],
      discountFlat: [0],
      discountPercentage: [0],
      calculatedDiscountAmount: [{ value: 0, disabled: true }],
      discount: [0],
      paymentStatus: ['', Validators.required],
      shipToParty: [''],
      internalNote: [''],
      expectedDeliveryDate: ['', Validators.required],
      paymentMode: ['', Validators.required],
      otherPaymentDetails: [{ value: '', disabled: true }],
      paidAmount: [0, Validators.required],
      dueAmount: [{ value: 0, disabled: true }],
      soldToParty: [''],
      // You may need to add these fields if they are part of your form
      poStatus: [''], 
      PONumber: [''],
    });
    // Payment mode listener
    this.orderForm.get('paymentMode')?.valueChanges.subscribe(value => {
      if (value === 'Others') {
        this.orderForm.get('otherPaymentDetails')?.enable();
      } else {
        this.orderForm.get('otherPaymentDetails')?.disable();
        this.orderForm.get('otherPaymentDetails')?.setValue('');
      }
    });
    // Discount listeners
    this.orderForm.get('isPercentageDiscount')?.valueChanges.subscribe(() => {
      this.calculateDiscount();
    });
    this.orderForm.get('discountFlat')?.valueChanges.subscribe(() => {
      this.calculateDiscount();
    });
    this.orderForm.get('discountPercentage')?.valueChanges.subscribe(() => {
      this.calculateDiscount();
    });
    this.addItem();
    this.setupFormListeners();
  }

  get items(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }

  fetchOrderDetails(): void {
    this.isLoading = true;
    this.orderService.getOrderById(this.soNumber).subscribe(
      (data) => {
        this.orderData = data;
        console.log(this.orderData);
        this.populateForm(data);
        this.isLoading = false;
      },
      (error) => {
        console.error('Failed to fetch order details:', error);
        this.isLoading = false;
      }
    );
  }

  populateForm(data: any): void {
    while (this.items.length) {
      this.items.removeAt(0);
    }
    this.orderForm.patchValue({
      clientEmail: data.CustomerEmail || '',
      customerName: data.Customer_name || '',
      clientContact: data.Customer_Contact || '',
      gst: data.GST || 0,
      discount: data.Discount || 0,
      grandTotal: data.GrandTotal || 0,
      paymentStatus: data.Payment_Status || '',
      shipToParty: data.ShipToParty || '',
      internalNote: data.InternalNote || '',
      expectedDeliveryDate: this.formatDate(data.Delivery_date),
      paymentMode: data.Payment_Mode || '',
      paidAmount: data.Total_Paid_Amount || 0,
      soldToParty: data.SoldToParty || '',
      poStatus: data.POStatus || 'Not Ordered',
      PONumber: data.PONumber || '',
    });
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item: any) => {
        this.addItem(item);
      });
    }
    this.updateSubAmount();
  }
  
  addItem(item?: any): void {
    const index = this.items.length;
    this.supplierCodes[index] = [];
    this.productSuggestions[index] = [];
    this.showProductSuggestions[index] = false;
    this.productSearchTerms[index] = new Subject<string>();
    const itemGroup = this.fb.group({
      selected: [item?.selected || false],
      SupplierCode: [item?.SupplierCode || '', Validators.required],
      ProductCode: [item?.ProductCode || '', Validators.required],
      ProductName: [item?.ProductName || '', Validators.required],
      rate: [item?.Price || 0, [Validators.required, Validators.min(0.01)]],
      quantity: [item?.Qty || 1, [Validators.required, Validators.min(1)]],
      total: [{ value: (item?.Price || 0) * (item?.Qty || 1), disabled: true }]
    });
    this.productSearchTerms[index].pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => this.orderService.searchProductsByCode(term))
    ).subscribe(products => {
      this.productSuggestions[index] = products;
      this.showProductSuggestions[index] = products.length > 0;
    });
    itemGroup.get('ProductCode')?.valueChanges.subscribe((productCode) => {
      if (productCode && productCode.length >= 3) {
        this.productSearchTerms[index].next(productCode);
      } else {
        this.showProductSuggestions[index] = false;
        if (!productCode) {
          this.clearProductData(index);
        }
      }
    });
    itemGroup.get('rate')?.valueChanges.subscribe(() => this.updateItemTotal(itemGroup, index));
    itemGroup.get('quantity')?.valueChanges.subscribe(() => this.updateItemTotal(itemGroup, index));
    this.items.push(itemGroup);
  }

  updateItemTotal(itemGroup: FormGroup, index: number): void {
    const rate = itemGroup.get('rate')?.value ?? 0;
    const qty = itemGroup.get('quantity')?.value ?? 1;
    const total = rate * qty;
    itemGroup.get('total')?.setValue(total, { emitEvent: false });
    this.updateStoredProduct(index, { rate, quantity: qty, total });
    this.updateSubAmount();
  }

  updateStoredProduct(index: number, updates: Partial<{ rate: number; quantity: number; total: number }>) {
    const productIndex = this.storeProductSupplierIdCodes.findIndex(item => item.index === index);
    if (productIndex !== -1) {
      this.storeProductSupplierIdCodes[productIndex] = {
        ...this.storeProductSupplierIdCodes[productIndex],
        ...updates
      };
    }
  }

  clearProductData(index: number) {
    const item = this.items.at(index);
    item.patchValue({
        ProductName: '',
        rate: 0,
        SupplierCode: ''
    });
    this.supplierCodes[index] = [];
    const productIndex = this.storeProductSupplierIdCodes.findIndex(p => p.index === index);
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
    if (!selectedSupplier) return;

    const item = this.items.at(index).getRawValue();
    this.orderService.getProductID(selectedSupplier.ProductCode, selectedSupplier.SupplierID)
      .subscribe((data: any) => {
        if (data && data.length > 0 && data[0].ProductID) {
          const productData = data[0];
          this.items.at(index).patchValue({
              ProductName: productData.ProductName,
              rate: productData.FinalPrice
          });

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

          const existingIndex = this.storeProductSupplierIdCodes.findIndex(prod => prod.index === index);
          if (existingIndex !== -1) {
            this.storeProductSupplierIdCodes[existingIndex] = productStorageData;
          } else {
            this.storeProductSupplierIdCodes.push(productStorageData);
          }
          this.updateItemTotal(this.items.at(index) as FormGroup, index);
        }
      });
  }

  clearSupplierData(index: number) {
    const item = this.items.at(index);
    item.patchValue({ ProductName: '', rate: 0 });
    const productIndex = this.storeProductSupplierIdCodes.findIndex(p => p.index === index);
    if (productIndex !== -1) {
      this.storeProductSupplierIdCodes.splice(productIndex, 1);
    }
    this.updateSubAmount();
  }

  onProductSuggestionMouseDown() {
    this.suppressBlur = true;
    setTimeout(() => this.suppressBlur = false, 200);
  }

  selectProductSuggestion(product: any, index: number) {
    this.suppressBlur = false;
    this.showProductSuggestions[index] = false;
    const itemControl = this.items.at(index);
    itemControl.get('ProductCode')?.setValue(product.ProductCode, { emitEvent: false }); // Prevent valueChanges loop

    this.orderService.getSupplierCodesByProductCode(product.ProductCode).subscribe(
      (data: any[]) => {
        if (data && data.length) {
          this.supplierCodes[index] = data.map(supplier => ({ ...supplier, ProductCode: product.ProductCode }));
          
          if (this.supplierCodes[index].length === 1) {
            const singleSupplier = this.supplierCodes[index][0];
            itemControl.get('SupplierCode')?.setValue(singleSupplier.SupplierCode);
            const event = { target: { value: singleSupplier.SupplierCode } } as unknown as Event;
            this.handleSupplierSelect(event, index);
          }
        } else {
          this.clearProductData(index);
        }
      }
    );
  }

  hideProductSuggestions(index: number) {
    if (!this.suppressBlur) {
      setTimeout(() => this.showProductSuggestions[index] = false, 200);
    }
  }

  onCheckboxChange(index: number, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.items.at(index).get('selected')?.setValue(isChecked);
    const itemIndex = this.storeProductSupplierIdCodes.findIndex(item => item.index === index);
    if (itemIndex !== -1) {
      this.storeProductSupplierIdCodes[itemIndex].Check = isChecked;
    }
  }

  removeItem(index: number) {
    this.items.removeAt(index);
    const itemIndex = this.storeProductSupplierIdCodes.findIndex(item => item.index === index);
    if (itemIndex !== -1) {
      this.storeProductSupplierIdCodes.splice(itemIndex, 1);
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
    // Re-key the helper objects
    const reKeyObject = (obj: any) => {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
            const numKey = parseInt(key, 10);
            if (numKey < removedIndex) newObj[numKey] = obj[numKey];
            else if (numKey > removedIndex) newObj[numKey - 1] = obj[numKey];
        });
        return newObj;
    };
    this.supplierCodes = reKeyObject(this.supplierCodes);
    this.productSuggestions = reKeyObject(this.productSuggestions);
    this.showProductSuggestions = reKeyObject(this.showProductSuggestions);
    this.productSearchTerms = reKeyObject(this.productSearchTerms);
  }

  setupFormListeners() {
    this.orderForm.get('gst')?.valueChanges.subscribe(() => this.updateGrandTotal());
    this.orderForm.get('discount')?.valueChanges.subscribe(() => this.updateGrandTotal());
    this.orderForm.get('paidAmount')?.valueChanges.subscribe(() => this.updateGrandTotal());
  }

  calculateDiscount() {
    const isPercentage = this.orderForm.get('isPercentageDiscount')?.value;
    const discountFlat = this.orderForm.get('discountFlat')?.value || 0;
    const discountPercentage = this.orderForm.get('discountPercentage')?.value || 0;
    const subTotal = this.orderForm.get('subAmount')?.value || 0;
    let finalDiscountAmount = 0;
    if (isPercentage) {
      finalDiscountAmount = (subTotal * discountPercentage) / 100;
    } else {
      finalDiscountAmount = discountFlat;
    }
    this.orderForm.get('calculatedDiscountAmount')?.setValue(finalDiscountAmount, { emitEvent: false });
    this.orderForm.get('discount')?.setValue(finalDiscountAmount); // Must emit event to trigger grand total update
  }

  updateSubAmount() {
    const subTotal = this.items.controls.reduce((sum, item) => sum + (item.get('total')?.value || 0), 0);
    this.orderForm.get('subAmount')?.setValue(subTotal);
    this.orderForm.get('totalAmount')?.setValue(subTotal);
    this.calculateDiscount(); // This will trigger grand total update
  }

  updateGrandTotal() {
    const subTotal = this.orderForm.get('subAmount')?.value || 0;
    const gstPercentage = this.orderForm.get('gst')?.value || 0;
    const discount = this.orderForm.get('discount')?.value || 0;
    const paidAmount = this.orderForm.get('paidAmount')?.value || 0;
    const discountedAmount = subTotal - discount;
    const gst = discountedAmount * (gstPercentage * 0.01);
    const grandTotal = parseFloat((discountedAmount + gst).toFixed(2));
    const dueAmount = parseFloat((grandTotal - paidAmount).toFixed(2));
    this.orderForm.get('grandTotal')?.setValue(grandTotal, { emitEvent: false });
    this.orderForm.get('dueAmount')?.setValue(dueAmount, { emitEvent: false });
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '';
    try {
      return formatDate(dateString, 'yyyy-MM-dd', 'en-US');
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  }

  private buildFinalDataPayload(): any {
    const orderData = this.orderForm.getRawValue();
    const itemsData = this.storeProductSupplierIdCodes.map(item => ({
        ProductID: item.ProductID || null,
        SupplierID: item.SupplierID || null,
        ProductCode: item.ProductCode || '',
        SupplierCode: item.SupplierCode || '',
        Qty: item.quantity || 0,
        Price: item.rate || 0,
        TotalPrice: (item.quantity || 0) * (item.rate || 0),
        Check: item.Check || false,
    }));

    let deliveryDateUTC = '';
    if (orderData.expectedDeliveryDate) {
        const localDate = new Date(orderData.expectedDeliveryDate);
        deliveryDateUTC = new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate())).toISOString();
    }

    return {
        Delivery_date: deliveryDateUTC || '',
        POStatus: orderData.poStatus || 'Not Ordered',
        PONumber: orderData.PONumber || '',
        CustomerEmail: orderData.clientEmail || '',
        Customer_name: orderData.customerName || '',
        Customer_Contact: orderData.clientContact || '',
        GST: orderData.gst || 0,
        SubTotal: orderData.subAmount || 0,
        DiscountAmount: orderData.discount || 0,
        GrandTotal: orderData.grandTotal || 0,
        DueAmount: orderData.dueAmount || 0,
        PaymentDetails: orderData.paymentMode === 'Others' ? orderData.otherPaymentDetails || '' : '',
        ShipToParty: orderData.shipToParty || '',
        SoldToParty: orderData.soldToParty || '',
        InternalNote: orderData.internalNote || '',
        Payment_Status: orderData.paymentStatus || '',
        Payment_Mode: orderData.paymentMode || '',
        Total_Paid_Amount: orderData.paidAmount || 0,
        items: itemsData
    };
  }
  
  // UPDATED METHOD: Just updates the order
  submitOrder() {
    if (this.orderForm.invalid) {
        alert('Please fill all required fields correctly.');
        // Optionally, mark fields as touched to show errors
        this.orderForm.markAllAsTouched();
        return;
    }
    this.isLoading = true;
    const finalData = this.buildFinalDataPayload();

    this.orderDetailsService.completeUpdateOrder(this.soNumber, finalData).subscribe({
        next: (response) => {
            this.isLoading = false;
            alert('Order updated successfully!');
        },
        error: (error) => {
            this.isLoading = false;
            console.error('Update failed:', error);
            alert('Failed to update order. Please try again.');
        }
    });
  }

  // UPDATED METHOD: Updates the order, then generates and prints the invoice on success.
// Fixed printInvoice() method in OrderDetailsComponent
printInvoice() {
  if (this.orderForm.invalid) {
    alert('Please fill all required fields correctly before printing an invoice.');
    this.orderForm.markAllAsTouched();
    return;
  }

  this.isLoading = true;
  
  // First update the order, then generate invoice from database data
  const finalDataForUpdate = this.buildFinalDataPayload();

  this.orderDetailsService.completeUpdateOrder(this.soNumber, finalDataForUpdate).subscribe({
    next: (response) => {
      console.log('Order updated successfully, now generating invoice...');
      
      // Generate invoice directly from SO number using database data
      this.updatedInvoiceService.generateInvoiceFromSO(this.soNumber).subscribe({
        next: (invoiceData) => {
          console.log('Invoice data generated:', invoiceData);
          this.isLoading = false;
          alert('Order updated successfully! Preparing invoice...');
          
          // Navigate to print view
          this.router.navigate(['/updated-invoice/', this.soNumber], { queryParams: { print: 'true' } });
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Failed to generate invoice:', error);
          alert('Order updated but failed to generate invoice. Please try again.');
        }
      });
    },
    error: (error) => {
      this.isLoading = false;
      console.error('Update failed:', error);
      alert('Failed to update order. Cannot generate invoice.');
    }
  });
}


  canDeleteProduct(): boolean {
    const poStatus = this.orderForm.get('poStatus')?.value;
    const pickupDateStr = this.orderForm.get('expectedDeliveryDate')?.value;
    if (!pickupDateStr) return !['Received', 'Scheduled for Delivery', 'Delivered'].includes(poStatus);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pickupDate = new Date(pickupDateStr);
    pickupDate.setHours(0, 0, 0, 0);

    const isPickupCrossed = pickupDate <= today;
    return !(['Received', 'Scheduled for Delivery', 'Delivered'].includes(poStatus) || isPickupCrossed);
  }

  deleteProduct(i: number, productCode: string) {
    if (!this.canDeleteProduct()) {
      alert('Cannot delete product: Status is locked or delivery date has passed.');
      return;
    }
    if (confirm('Are you sure you want to delete this product from the order?')) {
        this.orderDetailsService.deleteProductFromOrder(this.soNumber, productCode).subscribe({
            next: () => {
                this.removeItem(i); // remove from FormArray UI and recalculate
                alert('Product deleted successfully.');
            },
            error: (err) => {
                console.error('Delete failed:', err);
                alert('Failed to delete product. Please try again later.');
            }
        });
    }
  }

  updateInvoice() {
    this.updateSubAmount();
    this.updateGrandTotal();
    alert('Invoice values recalculated on page!');
  }
}