import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../../services/purchase.service';
import { Purchase } from '../../models/purchases.model';
import { AlertOctagon } from 'lucide';
import { AddOrderService } from '../../services/addOrder.service';

@Component({
  selector: 'app-purchase',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, NgIf, NgFor],
  templateUrl: './purchase.component.html',
  styleUrls: ['./purchase.component.css']
})
export class PurchaseComponent implements OnInit {
  purchases: Purchase[] = [];
  filteredPurchases: Purchase[] = [];
  currentPage: number = 1;
  pageSize: number = 10;
  pageSizeOptions: number[] = [10, 20, 30, 100, 200];
  searchQuery: string = '';
  showModal: boolean = false;
  isEditing: boolean = false;
  selectedPurchase: Purchase | null = null;
  
  totalItems: number = 0;
  // New properties for supplier management
  suppliers: { SupplierCode: number, SupplierName?: string }[] = [];
  isLoadingSuppliers: boolean = false;

  // Sorting properties
  sortColumn: keyof Purchase | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  constructor(
    private purchaseService: PurchaseService,
    private cdr: ChangeDetectorRef,
    private addOrderService : AddOrderService,
  ){}
  
  ngOnInit() {
    this.loadPurchases();
  }
  
  loadPurchases() {
    this.purchaseService.getPurchases(this.currentPage, this.pageSize).subscribe((response) => {
      console.log(response);
      this.purchases = response.data.map(purchase => ({ ...purchase, selected: false }));
       
         this.totalItems = response.pagination.total;
        this.applySorting();
        this.cdr.detectChanges();
    });
  }


  
  getSelectedPurchases() {
    return this.purchases.filter((purchase: Purchase) => purchase.selected);
  }
  
  // Fetch suppliers based on product code
  fetchSuppliers() {
    if (!this.selectedPurchase || !this.selectedPurchase.ProductCode) {
      this.suppliers = [];
      return;
    }
    
    this.isLoadingSuppliers = true;
    this.addOrderService.getSupplierCodesByProductCode(this.selectedPurchase.ProductCode).subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers;
        console.log(suppliers);
        this.isLoadingSuppliers = false;
        
        // If there's only one supplier, auto-select it
        if (suppliers.length === 1) {
          this.selectedPurchase!.SupplierCode = suppliers[0].SupplierCode;
          this.selectedPurchase!.SupplierID = suppliers[0].SupplierID;
          this.addOrderService.getProductID(this.selectedPurchase!.ProductCode, this.selectedPurchase!.SupplierID).subscribe({
            next: (data) => {
              console.log("PRoDUct Data ",data);
              if (data.length > 0 && this.selectedPurchase) {
                this.selectedPurchase.ProductID = data[0].ProductID;
              }
            },
            error: (err) => {
              console.error('Failed to fetch product ID:', err);
            }
          });
        } else if (suppliers.length === 0) {
          // Clear supplier if no suppliers found
          this.selectedPurchase!.SupplierCode = '';
        }
      },
      error: (err) => {
        console.error('Failed to fetch suppliers:', err);
        this.isLoadingSuppliers = false;
        this.suppliers = [];
      }
    });
  }
  
  // generating po number 
  createPONumber() {
    const selectedPurchases = this.getSelectedPurchases();
    if (selectedPurchases.length === 0) {
      alert('Please select at least one purchase to save');
      return;
    }
    console.log("selected for save : ", selectedPurchases);
    this.purchaseService.saveToSendMail(selectedPurchases).subscribe(
      () => {
        alert('Created PO Number');
        this.loadPurchases();
      },
      (error) => {
        console.error('Error creating po number', error);
        alert('Failed to create PO number');
      }
    );
    this.cdr.detectChanges();
    this.loadPurchases();
  }
  
  sendEmails() {
    const selectedPurchases = this.getSelectedPurchases();
    const confirmedPurchases = selectedPurchases.filter(purchase => purchase.POStatus === "Confirmed"
      
    );
    const isPickUpDateValid = selectedPurchases.filter(purchase => purchase.Supplier_Date === null ||
       purchase.Supplier_Date === undefined || purchase.Supplier_Date === '');
    if (isPickUpDateValid.length > 0) {
      alert("Please select a pickup date for selected purchases before sending emails.");
      return;
    }
    if (confirmedPurchases.length > 0) {
      alert("Cannot send email to a Confirmed Purchase");
      return;
    }
    if (selectedPurchases.length === 0) {
      alert('Please select at least one purchase to send emails.');
      return;
    }
    console.log("Selected", selectedPurchases);
    this.purchaseService.sendMail(selectedPurchases).subscribe(
      () => {
        alert('Emails sent successfully!');
        setTimeout(() => {
          this.loadPurchases();
        }, 4000);
      },
      (error) => {
        console.error('Error sending email:', error);
        alert('Failed to send emails.');
      }
    );
  }
  
  onPageSizeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) {
      this.pageSize = Number(target.value);
      this.currentPage = 1;
      this.loadPurchases();
    }
  }

decrementPage() {
  if (this.currentPage > 1) {
    this.currentPage--;
    this.loadCurrentData();
     this.cdr.detectChanges(); 
  }
}

incrementPage() {
  if (this.currentPage < this.totalPages) {
    this.currentPage++;
    this.loadCurrentData();
     this.cdr.detectChanges(); 
  }
}

// New helper method to determine which data to load
loadCurrentData() {
  if (this.searchQuery.trim() !== '') {
    this.searchPurchases();
  } else {
    this.loadPurchases();
  }
}

 get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }
  get paginatedPurchases(): Purchase[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.purchases.slice(start, start + this.pageSize);
  }

  sortTable(column: keyof Purchase) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  
    this.applySorting();
    this.currentPage = 1; // Reset to first page when sorting
  }
  
  applySorting() {
    if (!this.sortColumn) return;
  
    const key = this.sortColumn as keyof Purchase;
    this.purchases.sort((a, b) => {
      let valueA = a[key] as string | number;
      let valueB = b[key] as string | number;
  
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }
  
      return valueA < valueB ? (this.sortDirection === 'asc' ? -1 : 1) :
             valueA > valueB ? (this.sortDirection === 'asc' ? 1 : -1) : 0;
    });
  }
  
searchPurchases() {
    if (!this.searchQuery.trim()) {
      this.currentPage = 1;
      this.loadPurchases();
      return;
    }

    this.purchaseService.searchPurchases(this.searchQuery, this.currentPage, this.pageSize).subscribe({
      next: (data: any) => {
        // Check if the response is an array or has a data property
        if (Array.isArray(data)) {
          this.purchases = data.map(p => ({ ...p, selected: false }));
          this.totalItems = data.length;
        } else if (data && data.data) {
          this.purchases = data.data.map((p: any) => ({ ...p, selected: false }));
          this.totalItems = data.pagination ? data.pagination.total : data.data.length;
        }
          this.cdr.detectChanges(); 
      },
      error: (error) => {
        console.error('Search error:', error);
      }
    });
  }

  addPurchase() {
    this.isEditing = false;
    this.selectedPurchase = {
      PurchaseID: 0,
      ProductCode: '',
      ProductID : 0,
      SupplierID : 0,
      SupplierCode: '',
      SONumber: '',
      POStatus: '',
      Delivery_date: '',
      PONumber: '',
      Qty: 0,
      Supplier_Date: '',
      Delayed_Date: '',
    };
    this.suppliers = []; // Clear suppliers
    this.showModal = true;
    console.log('Modal state:', this.showModal);
  }

  editPurchase(purchase: Purchase) {
    this.isEditing = true;
    console.log("Editing purchase", purchase);
    this.selectedPurchase = { ...purchase };
    //  // Format the dates properly for date inputs
    //  if (this.selectedPurchase.Delivery_date) {
    //   const date = new Date(this.selectedPurchase.Delivery_date);
    //   const yyyy = date.getFullYear();
    //   const mm = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-based
    //   const dd = String(date.getDate()).padStart(2, '0');
    //   this.selectedPurchase.Delivery_date = `${yyyy}-${mm}-${dd}`;
    // }
    
  
  // if (this.selectedPurchase.Supplier_Date) {
  //   this.selectedPurchase.Supplier_Date = new Date(this.selectedPurchase.Supplier_Date)
  //     .toISOString().split('T')[0];
  // }
    console.log("Selected Purchase", this.selectedPurchase);
    this.showModal = true;
    // Fetch suppliers for this product
    this.fetchSuppliers();
  }

  savePurchase() {
    if (!this.selectedPurchase) return;
    
    // Validate required fields
    if (!this.selectedPurchase.PurchaseID || 
        !this.selectedPurchase.POStatus || 
        !this.selectedPurchase.ProductCode ||
        !this.selectedPurchase.SupplierCode) {
      alert('Please fill all required fields including selecting a supplier.');
      return;
    }
    
    if (this.isEditing) {
      this.purchaseService.editPurchase(this.selectedPurchase).subscribe({
        next: () => {
          this.loadPurchases();
          this.closeModal();
        },
        error: (err) => console.error('Failed to update purchase:', err)
      });
    } else {
      this.selectedPurchase.PurchaseID = Math.max(0, ...this.purchases.map(p => p.PurchaseID)) + 1;
      console.log("saving purchase", this.selectedPurchase);
      this.purchaseService.addPurchase(this.selectedPurchase).subscribe({
        next: () => {
          this.loadPurchases();
          this.closeModal();
        },
        error: (err) => console.error('Failed to add purchase:', err)
      });
    }
  }

  deletePurchase(id: number) {
    if (confirm('Are you sure you want to delete this purchase?')) {
      this.purchaseService.deletePurchase(id).subscribe({
        next: () => {
          console.log("purchase delete successfully");
          this.loadPurchases();
        },
        error: (err) => console.error('Failed to delete purchase:', err)
      });
    }
  }

  closeModal() {
    this.showModal = false;
    this.selectedPurchase = null;
  }

  preventModalClose(event: Event) {
    event.stopPropagation();
  }

  // Adding the missing methods
  selectAll(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.purchases.forEach(purchase => {
      purchase.selected = isChecked;
    });
  }
}