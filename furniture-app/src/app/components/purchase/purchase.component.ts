import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../../services/purchase.service';
import { Purchase } from '../../models/purchases.model';
import { AddOrderService } from '../../services/addOrder.service';

@Component({
  selector: 'app-purchase',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase.component.html',
  styleUrls: ['./purchase.component.css']
})
export class PurchaseComponent implements OnInit {
  purchases: Purchase[] = [];
  filteredPurchases: Purchase[] = []; // This property seems unused, consider removing if not needed.
  currentPage: number = 1;
  pageSize: number = 10;
  pageSizeOptions: number[] = [10, 20, 30, 100, 200];
  searchQuery: string = '';
  showModal: boolean = false;
  isEditing: boolean = true;
  selectedPurchase: Purchase | null = null;
  
  totalItems: number = 0;
  // New properties for supplier management
  suppliers: { SupplierCode: number, SupplierName?: string, SupplierID?: number, ProductID?: number, FinalPrice?: number }[] = [];
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
    // Build sort parameters
    const sortBy = this.sortColumn || 'PurchaseID'; // Default sort by PurchaseID if no column selected
    const sortOrder = this.sortDirection || 'desc'; // Default sort order

    this.purchaseService.getPurchases(this.currentPage, this.pageSize, sortBy, sortOrder).subscribe((response) => {
      console.log("API Response for loadPurchases:", response);
      this.purchases = response.data.map((purchase: Purchase) => ({ ...purchase, selected: false }));
      this.totalItems = response.pagination.total;
      this.cdr.detectChanges(); // Trigger change detection after updating data
    }, (error) => {
      console.error('Error loading purchases:', error);
      // Handle error, e.g., show a message to the user
    });
  }
  
  getSelectedPurchases(): Purchase[] {
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
        console.log("Suppliers fetched:", suppliers);
        this.isLoadingSuppliers = false;
        
        // If there's only one supplier, auto-select it
        if (suppliers.length === 1) {
          console.log("Single supplier found, auto-selecting:", suppliers[0]);
          if (this.selectedPurchase) {
            this.selectedPurchase.SupplierCode = suppliers[0].SupplierCode.toString(); // Ensure string type if needed
            this.selectedPurchase.SupplierID = suppliers[0].SupplierID;
            // Fetch ProductID and FinalPrice for the auto-selected supplier
            this.addOrderService.getProductID(this.selectedPurchase.ProductCode, this.selectedPurchase.SupplierID).subscribe({
              next: (data) => {
                console.log("Product Data for auto-selected supplier:", data);
                if (data.length > 0 && this.selectedPurchase) {
                  this.selectedPurchase.ProductID = data[0].ProductID;
                  this.selectedPurchase.FinalPrice = data[0].FinalPrice;
                }
              },
              error: (err) => {
                console.error('Failed to fetch product ID for auto-selected supplier:', err);
              }
            });
          }
        } else if (suppliers.length === 0) {
          // Clear supplier if no suppliers found
          if (this.selectedPurchase) {
            this.selectedPurchase.SupplierCode = '';
            this.selectedPurchase.SupplierID = 0; // Clear SupplierID as well
            this.selectedPurchase.ProductID = 0; // Clear ProductID
            this.selectedPurchase.FinalPrice = 0; // Clear FinalPrice
          }
        }
      },
      error: (err) => {
        console.error('Failed to fetch suppliers:', err);
        this.isLoadingSuppliers = false;
        this.suppliers = [];
      }
    });
  }
  
  searchPurchases() {
    if (!this.searchQuery.trim()) {
      this.currentPage = 1;
      this.loadPurchases(); // Load all purchases if search query is empty
      return;
    }

    // Build sort parameters for search
    const sortBy = this.sortColumn || 'PurchaseID';
    const sortOrder = this.sortDirection || 'desc';

    this.purchaseService.searchPurchases(this.searchQuery, this.currentPage, this.pageSize, sortBy, sortOrder).subscribe({
      next: (data: any) => {
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
        // Optionally, show an error message to the user
      }
    });
  }

  addPurchase() {
    this.isEditing = false;
    this.selectedPurchase = {
      PurchaseID: 0,
      ProductCode: '',
      ProductID : 0,
      FinalPrice: 0,
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
    this.suppliers = []; // Clear suppliers when adding a new purchase
    this.showModal = true;
    console.log('Modal state:', this.showModal);
  }

  editPurchase(purchase: Purchase) {
    this.isEditing = true;
    console.log("Editing purchase", purchase);

    this.selectedPurchase = { ...purchase }; // Create a copy to avoid direct modification
    
    console.log("Selected Purchase for editing:", this.selectedPurchase);
    this.showModal = true;
    // Fetch suppliers for this product when opening the edit modal
    this.fetchSuppliers();
  }

  savePurchase() {
    if (!this.selectedPurchase) return;
    
    // Basic validation for required fields
    if (!this.selectedPurchase.POStatus || 
        !this.selectedPurchase.ProductCode ||
        !this.selectedPurchase.SupplierCode ||
        !this.selectedPurchase.SONumber ||
        !this.selectedPurchase.Delivery_date ||
        !this.selectedPurchase.Qty) {
      alert('Please fill all required fields: PO Status, Product Code, Supplier Code, SO Number, Delivery Date, and Quantity.');
      return;
    }

    // Function to format dates to ISO string (UTC)
    const formatToISO = (date: string | Date | null | undefined) => {
      if (!date) return null;
      try {
        const d = new Date(date);
        // Check if the date is valid
        if (isNaN(d.getTime())) {
          console.warn('Invalid date detected:', date);
          return null; // Return null for invalid dates
        }
        return d.toISOString();
      } catch (e) {
        console.error('Error formatting date:', date, e);
        return null; // Return null if date parsing fails
      }
    };

    // Apply date formatting
    this.selectedPurchase.Delivery_date = formatToISO(this.selectedPurchase.Delivery_date) ?? '';
    this.selectedPurchase.Supplier_Date = formatToISO(this.selectedPurchase.Supplier_Date) ?? '';
    this.selectedPurchase.Delayed_Date = formatToISO(this.selectedPurchase.Delayed_Date) ?? '';

    if (this.isEditing) {
      this.purchaseService.editPurchase(this.selectedPurchase).subscribe({
        next: () => {
          alert('Purchase updated successfully!');
          this.loadPurchases(); // Reload data after update
          this.closeModal();
        },
        error: (err) => {
          console.error('Failed to update purchase:', err);
          alert('Failed to update purchase. Please check console for details.');
        }
      });
    } else {
      console.log("Adding purchase", this.selectedPurchase);
      this.purchaseService.addPurchase(this.selectedPurchase).subscribe({
        next: () => {
          alert('Purchase added successfully!');
          this.loadPurchases(); // Reload data after add
          this.closeModal();
        },
        error: (err) => {
          console.error('Failed to add purchase:', err);
          alert('Failed to add purchase. Please check console for details.');
        }
      });
    }
  }

  deletePurchase(id: number) {
    // Using a custom modal or a more user-friendly confirmation is recommended over `confirm()`
    if (confirm('Are you sure you want to delete this purchase?')) {
      this.purchaseService.deletePurchase(id).subscribe({
        next: () => {
          console.log("Purchase deleted successfully");
          this.loadPurchases(); // Reload data after delete
        },
        error: (err) => {
          console.error('Failed to delete purchase:', err);
          alert('Failed to delete purchase. Please check console for details.');
        }
      });
    }
  }

  closeModal() {
    this.showModal = false;
    this.selectedPurchase = null; // Clear selected purchase when closing modal
  }

  preventModalClose(event: Event) {
    event.stopPropagation(); // Prevents clicks inside the modal from closing it
  }
  
  // generating po number 
  createPONumber() {
    const selectedPurchases = this.getSelectedPurchases();
    if (selectedPurchases.length === 0) {
      alert('Please select at least one purchase to save');
      return;
    }
    console.log("Selected for PO Number creation:", selectedPurchases);
    this.purchaseService.saveToSendMail(selectedPurchases).subscribe(
      () => {
        alert('Created PO Number successfully!');
        this.loadPurchases(); // Reload data to reflect new PO numbers
      },
      (error) => {
        console.error('Error creating PO number:', error);
        alert('Failed to create PO number. Please check console for details.');
      }
    );
  }
  
  sendEmails() {
    const selectedPurchases = this.getSelectedPurchases();
    const confirmedPurchases = selectedPurchases.filter(purchase => purchase.POStatus === "Confirmed");
    
    // Check for missing pickup dates
    const isPickupDateMissing = selectedPurchases.some(purchase => 
      !purchase.Supplier_Date || purchase.Supplier_Date === ''
    );

    if (isPickupDateMissing) {
      alert("Please select a pickup date for all selected purchases before sending emails.");
      return;
    }

    if (confirmedPurchases.length > 0) {
      alert("Cannot send email to a Confirmed Purchase.");
      return;
    }

    if (selectedPurchases.length === 0) {
      alert('Please select at least one purchase to send emails.');
      return;
    }

    console.log("Selected for sending emails:", selectedPurchases);
    this.purchaseService.sendMail(selectedPurchases).subscribe(
      () => {
        alert('Emails sent successfully!');
        // A small delay before reloading to allow backend to process
        setTimeout(() => {
          this.loadPurchases();
        }, 2000); 
      },
      (error) => {
        console.error('Error sending email:', error);
        alert('Failed to send emails. Please check console for details.');
      }
    );
  }
  
  onPageSizeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) {
      this.pageSize = Number(target.value);
      this.currentPage = 1; // Reset to first page
      this.loadCurrentData(); // Load data with new page size
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

  // Helper method to determine which data to load (search or all purchases)
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

  // This `paginatedPurchases` getter might not be needed if `loadPurchases` and `searchPurchases`
  // already handle pagination by fetching only the current page's data from the API.
  // If your API returns all data and you're slicing it locally, then keep this.
  // Otherwise, if the API handles pagination, you can remove this.
  get paginatedPurchases(): Purchase[] {
    // Assuming `this.purchases` already contains the paginated data from the API.
    // If your API returns ALL data and you need to slice it here for display,
    // then the slicing logic below is correct.
    // const start = (this.currentPage - 1) * this.pageSize;
    // return this.purchases.slice(start, start + this.pageSize);
    return this.purchases; // If API returns paginated data directly
  }

  sortTable(column: keyof Purchase) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.currentPage = 1; // Reset to first page when sorting
    this.loadCurrentData(); // Load data with new sort parameters
  }

  // This `applySorting` method is likely redundant if `loadPurchases` and `searchPurchases`
  // already send sorting parameters to the backend and receive sorted data.
  // If sorting is done client-side after fetching all data, then keep this.
  applySorting() {
    if (!this.sortColumn) return;
  
    const key = this.sortColumn as keyof Purchase;
    this.purchases.sort((a, b) => {
      let valueA = a[key] as string | number | Date | null | undefined;
      let valueB = b[key] as string | number | Date | null | undefined;
  
      // Handle null/undefined values for sorting
      if (valueA === null || valueA === undefined) valueA = '';
      if (valueB === null || valueB === undefined) valueB = '';

      // Convert to string for localeCompare if they are dates or numbers
      if (valueA instanceof Date) valueA = valueA.toISOString();
      if (valueB instanceof Date) valueB = valueB.toISOString();
      if (typeof valueA === 'number') valueA = valueA.toString();
      if (typeof valueB === 'number') valueB = valueB.toString();

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }
  
      return valueA < valueB ? (this.sortDirection === 'asc' ? -1 : 1) :
             valueA > valueB ? (this.sortDirection === 'asc' ? 1 : -1) : 0;
    });
  }

  // --- NEWLY ADDED/MODIFIED METHODS FOR TEMPLATE COMPATIBILITY ---

  /**
   * Checks if a given column is currently sorted.
   * Used in the HTML template for applying the 'sorted' class.
   * @param columnName The name of the column to check.
   * @returns True if the column matches the current sortColumn, false otherwise.
   */
  isSortedBy(columnName: keyof Purchase): boolean {
    return this.sortColumn === columnName;
  }

  /**
   * Returns the appropriate sort icon (▲ for ascending, ▼ for descending)
   * based on the current sort direction for a given column.
   * Used in the HTML template to display the sort indicator.
   * @param columnName The name of the column.
   * @returns A string representing the sort icon or an empty string if not sorted by this column.
   */
  getSortIcon(columnName: keyof Purchase): string {
    if (this.sortColumn === columnName) {
      return this.sortDirection === 'asc' ? '▲' : '▼';
    }
    return '';
  }

  /**
   * Toggles the selection state of all purchase items.
   * Renamed from `selectAll` to `toggleSelectAll` to match HTML.
   * @param event The change event from the checkbox.
   */
  toggleSelectAll(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.purchases.forEach(purchase => {
      purchase.selected = isChecked;
    });
  }

  // Add this method to your PurchaseComponent class
  toggleRowSelection(purchase: Purchase, event: Event) {
    // Prevent selection when clicking on action buttons
    const target = event.target as HTMLElement;
    if (
      target.closest('.actions') ||
      target.closest('button') ||
      ((target as HTMLInputElement).type === 'checkbox')
    ) {
      return;
    }
    
    purchase.selected = !purchase.selected;
  }
}
