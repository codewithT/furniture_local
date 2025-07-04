import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ScheduleDeliveryService, DeliveryProduct } from '../../services/schedule-delivery.service';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';

export interface PendingStatusUpdate {
  product: DeliveryProduct;
  newStatus: string;
  oldStatus: string;
}

export interface PaginationResponse {
  data: DeliveryProduct[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Component({
  selector: 'app-schedule-delivery',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, NgIf, NgFor,
    MatDatepickerModule, MatDialogModule, MatNativeDateModule, MatInputModule
  ],
  templateUrl: './schedule-delivery.component.html',
  styleUrls: ['./schedule-delivery.component.css']
})

export class ScheduleDeliveryComponent implements OnInit, AfterViewInit {
  deliveryProducts: DeliveryProduct[] = [];
  searchQuery: string = '';
  pageSizeOptions: number[] = [5, 10, 20, 50];
  pageSize: number = 10;
  currentPage: number = 1;
  totalPages: number = 1;
  totalRecords: number = 0;
  sortDirection: 'asc' | 'desc' = 'asc';
  sortColumn: keyof DeliveryProduct | null = null;
  selectedDate: string = '';
  isLoading: boolean = false;
  
  @ViewChild('signatureViewDialog') signatureViewDialog: any;
  @ViewChild('statusUpdateDialog') statusUpdateDialog: any;
  selectedSignature: string | null = null;
  dialogRef!: MatDialogRef<any>;

  @ViewChild('signatureCanvas') signatureCanvas?: ElementRef;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;

  @ViewChild('signatureDialog') signatureDialogTemplate!: TemplateRef<any>;
  signatureImage: string | null = null;
  selectedProduct: DeliveryProduct | null = null;
  currentDialogRef: MatDialogRef<any, any> | null = null;

  // SO Status related properties
  soStatusOptions: string[] = [
    'Scheduled for Delivery',
    'Out for Delivery', 
    'Not Delivered',
    'Delivered'
  ];
  
  pendingStatusUpdate: PendingStatusUpdate | null = null;

  constructor(private scheduleDeliveryService: ScheduleDeliveryService, public dialog: MatDialog) {}

  ngOnInit() {
    this.getDeliveryProducts();
  }

  ngAfterViewInit() {
    this.canvas = this.signatureCanvas?.nativeElement;
    if (!this.canvas) {
      console.error('Canvas element not found.');
      return;
    }
  
    const context = this.canvas.getContext('2d');
    if (!context) {
      console.error('Failed to get 2D context for the signature canvas');
      return;
    }
  
    this.ctx = context;
    this.ctx.strokeStyle = 'black';
    this.ctx.lineWidth = 2;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
  
    this.addCanvasListeners();
  }
  
  getEventCoordinates(event: MouseEvent | TouchEvent) {
    let offsetX: number, offsetY: number;
    if (event instanceof MouseEvent) {
      offsetX = event.offsetX;
      offsetY = event.offsetY;
    } else {
      const rect = this.canvas.getBoundingClientRect();
      offsetX = event.touches[0].clientX - rect.left;
      offsetY = event.touches[0].clientY - rect.top;
    }
    return { offsetX, offsetY };
  }

  addCanvasListeners() {
    this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
    this.canvas.addEventListener('mousemove', this.draw.bind(this));
    this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
    this.canvas.addEventListener('mouseleave', this.stopDrawing.bind(this));
  }

  startDrawing(event: MouseEvent | TouchEvent) {
    this.isDrawing = true;
    const { offsetX, offsetY } = this.getEventCoordinates(event);
    this.ctx.beginPath();
    this.ctx.moveTo(offsetX, offsetY);
  }
  
  draw(event: MouseEvent | TouchEvent) {
    if (!this.isDrawing) return;
    const { offsetX, offsetY } = this.getEventCoordinates(event);
    this.ctx.lineTo(offsetX, offsetY);
    this.ctx.stroke();
  }

  stopDrawing() {
    this.isDrawing = false;
    this.ctx.closePath();
  }

  clearSignature() {
    if (!this.ctx) {
      console.error('Canvas context is not initialized.');
      return;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  openSignatureDialog(deliveryProduct: DeliveryProduct) {
    this.selectedProduct = deliveryProduct;
    this.signatureImage = null;
  
    const dialogRef = this.dialog.open(this.signatureDialogTemplate);
  
    dialogRef.afterOpened().subscribe(() => {
      setTimeout(() => {
        if (!this.signatureCanvas) {
          console.error('Canvas element not found inside dialog.');
          return;
        }
  
        this.canvas = this.signatureCanvas.nativeElement;
        const context = this.canvas.getContext('2d');
  
        if (!context) {
          console.error('Failed to get 2D context for the signature canvas');
          return;
        }
  
        this.ctx = context;
        this.addCanvasListeners();
      }, 0);
    });
  
    dialogRef.afterClosed().subscribe(() => {
      this.signatureImage = null;
    });
  
    this.currentDialogRef = dialogRef;
  }

  saveSignature(selectedProduct: DeliveryProduct | null, dialogRef: MatDialogRef<any>) {
    if (!this.canvas) return;
  
    this.canvas.toBlob((blob) => {
      if (blob && selectedProduct && selectedProduct.SalesID) {
        const formData = new FormData();
        formData.append('signature', blob, 'signature.png');
        formData.append('soNumber', selectedProduct.SONumber.toString());
  
        this.scheduleDeliveryService.uploadSignature(formData).subscribe({
          next: () => {
            console.log('Signature uploaded successfully.');
            alert('Signature uploaded successfully.');
            if (selectedProduct) {
              selectedProduct.SOStatus = 'Delivered';
              this.updateSOStatusInBackend(selectedProduct, 'Delivered');
            }
          },
          error: (err) => {
            console.error('Error uploading signature:', err);
          }
        });
      }
    }, 'image/png');
  
    if (selectedProduct) {
      selectedProduct.selected = false;
    }
  
    if (this.currentDialogRef) {
      this.currentDialogRef.close();
      this.currentDialogRef = null;
    }
  }
  
  viewSignature(deliver: DeliveryProduct) {
    const salesID = deliver.SalesID;
  
    this.scheduleDeliveryService.getSignature(salesID).subscribe(
      (blob: Blob) => {
        const reader = new FileReader();
        console.log("BLOBB ", blob);
        
        if (!(blob instanceof Blob) || blob.size === 0) {
          return;
        }

        reader.onloadend = () => {
          this.selectedSignature = reader.result as string;
          console.log("Signature base64:", this.selectedSignature);
          this.dialogRef = this.dialog.open(this.signatureViewDialog);
        };
        reader.readAsDataURL(blob);
      },
      (error) => {
        if (error.status === 404) {
          alert('Signature not uploaded yet.');
        } else {
          console.error('Error fetching signature:', error);
        }
      }
    );
  }

  closeSignatureDialog() {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }

  // SO Status Management Methods
  updateSOStatus(product: DeliveryProduct) {
    const originalProduct = this.deliveryProducts.find(p => p.SalesID === product.SalesID);
    if (!originalProduct) return;

    this.pendingStatusUpdate = {
      product: product,
      newStatus: product.SOStatus,
      oldStatus: originalProduct.SOStatus || ''
    };

    this.dialog.open(this.statusUpdateDialog, {
      width: '600px',
      disableClose: true
    });
  }

  confirmStatusUpdate() {
    if (!this.pendingStatusUpdate) return;

    const { product, newStatus } = this.pendingStatusUpdate;
    
    this.updateSOStatusInBackend(product, newStatus);
    
    this.dialog.closeAll();
    this.pendingStatusUpdate = null;
  }

  cancelStatusUpdate() {
    if (!this.pendingStatusUpdate) return;

    const { product, oldStatus } = this.pendingStatusUpdate;
    product.SOStatus = oldStatus;
    
    this.dialog.closeAll();
    this.pendingStatusUpdate = null;
  }

  private updateSOStatusInBackend(product: DeliveryProduct, newStatus: string) {
    const updateData = {
      salesID: product.SalesID,
      soNumber: product.SONumber,
      newStatus: newStatus
    };

    this.scheduleDeliveryService.updateSOStatus(updateData).subscribe({
      next: (response: any) => {
        console.log('PO Status updated successfully:', response);
        this.showStatusUpdateSuccess(newStatus);
        this.getDeliveryProducts();
      },
      error: (error: any) => {
        console.error('Error updating PO status:', error);
        this.showStatusUpdateError();
        
        const originalProduct = this.deliveryProducts.find(p => p.SalesID === product.SalesID);
        if (originalProduct && this.pendingStatusUpdate) {
          product.SOStatus = this.pendingStatusUpdate.oldStatus;
        }
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Scheduled for Delivery':
        return 'status-scheduled';
      case 'Out for Delivery':
        return 'status-out-for-delivery';
      case 'Not Delivered':
        return 'status-not-delivered';
      case 'Delivered':
        return 'status-delivered';
      default:
        return 'status-default';
    }
  }

  private showStatusUpdateSuccess(status: string) {
    alert(`PO Status updated to "${status}" successfully!`);
  }

  private showStatusUpdateError() {
    alert('Failed to update PO Status. Please try again.');
  }

  // Updated method to use backend pagination
  getDeliveryProducts() {
    this.isLoading = true;
    
    const params = {
      page: this.currentPage,
      limit: this.pageSize,
      sortBy: this.sortColumn || 'Delivery_date',
     sortOrder: this.sortDirection.toUpperCase() as 'ASC' | 'DESC'

    };

    this.scheduleDeliveryService.getDeliveryProducts(params).subscribe({
      next: (response: PaginationResponse) => {
         this.deliveryProducts = response.data.map(product => ({
  ...product, 
  Transfer_Date: product.Transfer_Date  ? new Date(product.Transfer_Date) : undefined,
  Delivery_date: product.Delivery_date ? new Date(product.Delivery_date) : undefined
}));

        
        this.totalPages = response.pagination.totalPages;
        this.totalRecords = response.pagination.totalRecords;
        this.currentPage = response.pagination.currentPage;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching delivery products:', error);
        this.isLoading = false;
      }
    });
  }

openCalendar(dialogTemplate: TemplateRef<any>) {
  const dialogRef = this.dialog.open(dialogTemplate, { width: '250px' });

  dialogRef.afterClosed().subscribe((result: Date | null) => {
    if (result instanceof Date && !isNaN(result.getTime())) {
      // Set time to 12:00 UTC to avoid timezone shifting
      const utcNoon = new Date(Date.UTC(result.getFullYear(), result.getMonth(), result.getDate(), 12));
      this.selectedDate = utcNoon.toISOString();
      this.scheduleDelivery();
    } else {
      console.warn('Invalid date selected:', result);
    }
  });
}




  // Updated search method to use backend pagination
  searchDelivery() {
    this.currentPage = 1; // Reset to first page when searching
    this.isLoading = true;
    
    if (!this.searchQuery.trim()) {
      this.getDeliveryProducts();
      return;
    }

    const params = {
      page: this.currentPage,
      limit: this.pageSize,
      sortBy: this.sortColumn || 'Delivery_date',
      sortOrder: this.sortDirection.toUpperCase() as 'ASC' | 'DESC'
    };

    this.scheduleDeliveryService.searchDeliveryProducts(this.searchQuery, params).subscribe({
      next: (response: PaginationResponse) => {
       this.deliveryProducts = response.data.map(product => ({
  ...product, 
  Transfer_Date: product.Transfer_Date  ? new Date(product.Transfer_Date) : undefined,
  Delivery_date: product.Delivery_date ? new Date(product.Delivery_date) : undefined
}));

        this.totalPages = response.pagination.totalPages;
        this.totalRecords = response.pagination.totalRecords;
        this.currentPage = response.pagination.currentPage;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error searching delivery products:', error);
        this.isLoading = false;
      }
    });
  }

scheduleDelivery() {
  const selectedItems = this.deliveryProducts.filter(product => product.selected);
   console.log('Selected items:', selectedItems);
    selectedItems.forEach(item => item.Transfer_Date = this.selectedDate);
 
  // Send array of updates
  this.scheduleDeliveryService.updateTransferDate(selectedItems).subscribe(
    () => this.getDeliveryProducts(),
    (error) => console.error('Error updating transfer date:', error)
  );
}

  sendTermsAndConditions() {
    console.log('Terms and conditions sent.');
  }

  // Updated sorting method to use backend pagination
  sortTable(property: keyof DeliveryProduct) {
    if (this.sortColumn === property) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = property;
      this.sortDirection = 'asc';
    }
    
    this.currentPage = 1; // Reset to first page when sorting
    
    if (this.searchQuery.trim()) {
      this.searchDelivery();
    } else {
      this.getDeliveryProducts();
    }
  }

  // Updated page size change handler
  onPageSizeChange() {
    this.currentPage = 1;
    if (this.searchQuery.trim()) {
      this.searchDelivery();
    } else {
      this.getDeliveryProducts();
    }
  }

  // Updated pagination methods
  incrementPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      if (this.searchQuery.trim()) {
        this.searchDelivery();
      } else {
        this.getDeliveryProducts();
      }
    }
  }

  decrementPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      if (this.searchQuery.trim()) {
        this.searchDelivery();
      } else {
        this.getDeliveryProducts();
      }
    }
  }

  // New method to go to specific page
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      if (this.searchQuery.trim()) {
        this.searchDelivery();
      } else {
        this.getDeliveryProducts();
      }
    }
  }

  // Generate page numbers for pagination display
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    
    if (this.totalPages <= maxPagesToShow) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, this.currentPage - 2);
      const end = Math.min(this.totalPages, start + maxPagesToShow - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }

  // ==================== ROW SELECTION METHODS ====================

  /**
   * Toggle row selection when clicking on the row (except actions column)
   */
  toggleRowSelection(deliver: DeliveryProduct, event: Event): void {
    const target = event.target as HTMLElement;
    const isInteractiveElement = target.tagName === 'BUTTON' ||
                                target.tagName === 'SELECT' ||
                                target.tagName === 'INPUT' ||
                                target.closest('.actions') ||
                                target.closest('select') ||
                                target.closest('button');
     
    if (!isInteractiveElement) {
      deliver.selected = !deliver.selected;
      this.updateSelectAllState();
    }
  }

  /**
   * Handle individual checkbox change
   */
  onCheckboxChange(deliver: DeliveryProduct): void {
    this.updateSelectAllState();
  }

  /**
   * Handle select all checkbox for current page
   */
  selectAll(event: any): void {
    const isChecked = event.target.checked;
    this.deliveryProducts.forEach(deliver => {
      deliver.selected = isChecked;
    });
  }

  /**
   * Update the select all checkbox state based on individual selections
   */
  updateSelectAllState(): void {
    setTimeout(() => {
      const selectAllCheckbox = document.querySelector('thead input[type="checkbox"]') as HTMLInputElement;
      if (selectAllCheckbox) {
        const totalItems = this.deliveryProducts.length;
        const selectedItems = this.deliveryProducts.filter(item => item.selected).length;
             
        if (selectedItems === 0) {
          selectAllCheckbox.checked = false;
          selectAllCheckbox.indeterminate = false;
        } else if (selectedItems === totalItems) {
          selectAllCheckbox.checked = true;
          selectAllCheckbox.indeterminate = false;
        } else {
          selectAllCheckbox.checked = false;
          selectAllCheckbox.indeterminate = true;
        }
      }
    }, 0);
  }

  /**
   * Get selected rows (from current page only)
   */
  getSelectedRows(): DeliveryProduct[] {
    return this.deliveryProducts.filter(deliver => deliver.selected);
  }

  /**
   * Get count of selected rows (from current page only)
   */
  getSelectedCount(): number {
    return this.deliveryProducts.filter(deliver => deliver.selected).length;
  }

  /**
   * Clear all selections (current page only)
   */
  clearAllSelections(): void {
    this.deliveryProducts.forEach(deliver => {
      deliver.selected = false;
    });
    this.updateSelectAllState();
  }

  /**
   * Select all rows (current page only)
   */
  selectAllRows(): void {
    this.deliveryProducts.forEach(deliver => {
      deliver.selected = true;
    });
    this.updateSelectAllState();
  }

  /**
   * Check if any row is selected
   */
  hasSelectedRows(): boolean {
    return this.getSelectedCount() > 0;
  }

  /**
   * Check if all rows are selected
   */
  areAllRowsSelected(): boolean {
    return this.deliveryProducts.length > 0 && this.getSelectedCount() === this.deliveryProducts.length;
  }

  // Image upload 
  onDeliveryImageSelected(event: any, salesID: number): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        alert('File size should not exceed 5MB.');
        return;
      }

      const formData = new FormData();
      formData.append('deliveryPicture', file);
      formData.append('salesID', salesID.toString());

      this.scheduleDeliveryService.uploadDeliveryPicture(formData).subscribe({
        next: (response: any) => {
          console.log('Delivery picture uploaded successfully:', response);
          alert('Delivery picture uploaded successfully!');
          // Refresh the data to show the new image
          this.getDeliveryProducts();
        },
        error: (error: any) => {
          console.error('Error uploading delivery picture:', error);
          alert('Failed to upload delivery picture. Please try again.');
        }
      });
    }
  }

  // Utility methods for better UX
  get isFirstPage(): boolean {
    return this.currentPage === 1;
  }

  get isLastPage(): boolean {
    return this.currentPage === this.totalPages;
  }

  get startRecord(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endRecord(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalRecords);
  }
}