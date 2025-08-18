import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, catchError, Observable, of, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UpdatedInvoiceService {

  private apiUrl = `${environment.apiBaseUrl}/u`;
  
  constructor(private http: HttpClient, private authService: AuthService) {}

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true  
  };

  private invoiceDataSubject = new BehaviorSubject<any>(null);
  public invoiceData$: Observable<any> = this.invoiceDataSubject.asObservable();

  setInvoiceData(data: any) {
    console.log('Setting invoice data:', data);
    this.invoiceDataSubject.next(data);
  }

  getInvoiceData(): Observable<any> {
    return this.invoiceData$;
  }

  // Get order data by SO number and transform it into invoice format
  getOrderForInvoice(soNumber: string): Observable<any> {
    console.log('Fetching order for SO:', soNumber);
    
    return this.http.get(`${this.apiUrl}/order-details/${soNumber}`, this.httpOptions).pipe(
      tap(orderData => console.log('Raw order data received:', orderData)),
      switchMap((orderData: any) => {
        if (!orderData) {
          console.error('No order data received');
          return of(null);
        }
        
        const invoiceData = this.transformOrderToInvoiceData(orderData, soNumber);
        console.log('Transformed invoice data:', invoiceData);
        this.setInvoiceData(invoiceData);
        return of(invoiceData);
      }),
      catchError(error => {
        console.error('Error fetching order data:', error);
        return of(null);
      })
    );
  }

  // Transform order data to invoice data format
  transformOrderToInvoiceData(orderData: any, soNumber: string): any {
    console.log('Transforming order data:', orderData);
    
    // Handle case where orderData might be nested or have different structure
    const data = orderData.data || orderData;
    
    // Map items from order data with better error handling
    const invoiceItems = (data.items || data.Items || []).map((item: any) => {
      const quantity = parseFloat(item.Qty || item.quantity || 0);
      const unitPrice = parseFloat(item.Price || item.unitPrice || item.Unit_Price || 0);
      
      return {
        productCode: item.ProductCode || item.Product_Code || item.productCode || '',
        supplierCode: item.SupplierCode || item.Supplier_Code || item.supplierCode || '',
        quantity: quantity,
        description: item.ProductName || item.Product_Name || item.Description || item.description || '',
        unitPrice: unitPrice,
        total: quantity * unitPrice
      };
    });

    console.log('Mapped invoice items:', invoiceItems);

    // Calculate financial values with better error handling
    const subTotal = parseFloat(data.SubTotal || data.Sub_Total || data.subTotal || 0);
    const discount = parseFloat(data.DiscountAmount || data.Discount_Amount || data.discount || 0);
    const gstPercentage = parseFloat(data.GST || data.gst || data.TaxRate || 0);
    const taxRate = gstPercentage / 100;
    const discountedAmount = subTotal - discount;
    const totalTax = discountedAmount * taxRate;
    const grandTotal = parseFloat(data.GrandTotal || data.Grand_Total || data.grandTotal || 0);
    const paidAmount = parseFloat(data.Total_Paid_Amount || data.Paid_Amount || data.paidAmount || 0);
    const balanceDue = grandTotal - paidAmount;

    const transformedData = {
      // Company details
      companyAddress: 'Calgary Furniture Emporium',
      companyContact: 'Phone: (555) 123-4567, Email: sales@cfe.com',
      
      // Invoice metadata
      invoiceDate: new Date(),
      invoiceNumber: `INV-${soNumber}`,
      soNumber: soNumber,
      paymentTerms: (data.Payment_Status || data.paymentStatus) === 'Full Paid' ? 'Paid in Full' : 'Due on Receipt',
      
      // Customer details
      billTo: {
        contactName: data.Customer_name || data.CustomerName || data.customer_name || '',
        companyName: data.Customer_name || data.CustomerName || data.customer_name || '',
        address: data.SoldToParty || data.Sold_To_Party || data.soldToParty || 'N/A',
        phone: data.Customer_Contact || data.CustomerContact || data.customer_contact || '',
        email: data.CustomerEmail || data.Customer_Email || data.customerEmail || ''
      },
      shipTo: {
        nameDept: data.Customer_name || data.CustomerName || data.customer_name || '',
        companyName: data.Customer_name || data.CustomerName || data.customer_name || '',
        address: data.ShipToParty || data.Ship_To_Party || data.shipToParty || data.SoldToParty || data.Sold_To_Party || 'Same as Bill To',
        phone: data.Customer_Contact || data.CustomerContact || data.customer_contact || ''
      },
      
      // Items
      invoiceItems: invoiceItems,
      
      // Financial calculations
      subTotal: subTotal,
      discount: discount,
      discountPercentage: 0,
      isPercentageDiscount: false,
      taxRate: taxRate,
      gstPercentage: gstPercentage,
      totalTax: totalTax,
      shippingHandling: 0,
      grandTotal: grandTotal,
      
      // Payment details
      modeofPayment: data.Payment_Mode || data.PaymentMode || data.payment_mode || '',
      otherPaymentDetails: data.PaymentDetails || data.Payment_Details || data.paymentDetails || '',
      paidAmount: paidAmount,
      dueAmount: balanceDue,
      paymentStatus: data.Payment_Status || data.PaymentStatus || data.payment_status || '',
      
      // Additional details
      notes: data.InternalNote || data.Internal_Note || data.notes || '',
      expectedDeliveryDate: data.Delivery_date || data.DeliveryDate || data.delivery_date || '',
      poStatus: data.POStatus || data.PO_Status || data.poStatus || 'Not Ordered',
      poNumber: data.PONumber || data.PO_Number || data.poNumber || ''
    };

    console.log('Final transformed data:', transformedData);
    return transformedData;
  }

  // Generate invoice data from SO number
  generateInvoiceFromSO(soNumber: string): Observable<any> {
    console.log('Generating invoice from SO:', soNumber);
    
    return this.getOrderForInvoice(soNumber).pipe(
      tap(invoiceData => {
        if (invoiceData) {
          console.log('Generated invoice data:', invoiceData);
          this.setInvoiceData(invoiceData);
        } else {
          console.error('Failed to generate invoice data');
        }
      }),
      catchError(error => {
        console.error('Failed to generate invoice from SO:', error);
        throw error;
      })
    );
  }
}