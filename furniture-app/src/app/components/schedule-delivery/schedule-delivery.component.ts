import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ScheduleDeliveryService, DeliveryProduct } from '../../services/schedule-delivery.service';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';

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
  paginatedDeliveryProducts: DeliveryProduct[] = [];
  searchQuery: string = '';
  pageSizeOptions: number[] = [5, 10, 20];
  pageSize: number = 10;
  currentPage: number = 1;
  totalPages: number = 1;
  sortDirection: 'asc' | 'desc' = 'asc';
  sortColumn: keyof DeliveryProduct | null = null;
  selectedDate: string = '';
  @ViewChild('signatureViewDialog') signatureViewDialog: any;
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
  
    this.ctx = context; // Assign the context only if it's valid
    this.ctx.strokeStyle = 'black'; // Ensure strokes are visible
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
  
    // Open the dialog and store the reference
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
  
    // Pass dialogRef correctly when calling saveSignature
    dialogRef.afterClosed().subscribe(() => {
      this.signatureImage = null;
    });
  
    // Store the dialogRef for closing later
    this.currentDialogRef = dialogRef;
  }
  
  

  saveSignature(selectedProduct: DeliveryProduct | null, dialogRef: MatDialogRef<any>) {
    if (!this.canvas) return;
  
    this.canvas.toBlob((blob) => {
      if (blob && selectedProduct && selectedProduct.SalesID) {
        const formData = new FormData();
        formData.append('signature', blob, 'signature.png');
        formData.append('soNumber', selectedProduct.SONumber.toString());
  
        // Call API to send to backend
        this.scheduleDeliveryService.uploadSignature(formData).subscribe({
          next: () => {
            console.log('Signature uploaded successfully.');
            alert('Signature uploaded successfully.');
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
       // Check if blob is actually a Blob and has some data
  if (!(blob instanceof Blob) || blob.size === 0) {
    
    return;
  }

        reader.onloadend = () => {
          this.selectedSignature = reader.result as string; // base64 image
          console.log("Signature base64:", this.selectedSignature); //
          this.dialogRef = this.dialog.open(this.signatureViewDialog);
        };
        reader.readAsDataURL(blob);
      },
      (error) => {
        if (error.status === 404) {
          alert('Signature not uploaded yet.');  // or open a placeholder dialog
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
  
  
  getDeliveryProducts() {
    this.scheduleDeliveryService.getDeliveryProducts().subscribe((data: DeliveryProduct[]) => {
      this.deliveryProducts = data;
      this.updatePagination();
    });
  }

  openCalendar(dialogTemplate: TemplateRef<any>) {
    const dialogRef = this.dialog.open(dialogTemplate, { width: '250px' });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.selectedDate = result;
        this.scheduleDelivery();
      }
    });
  }

  searchDelivery() {
    if (!this.searchQuery.trim()) {
      this.getDeliveryProducts();
      return;
    }
    this.scheduleDeliveryService.searchDeliveryProducts(this.searchQuery).subscribe(
      (filtered) => this.paginatedDeliveryProducts = filtered.slice(0, this.pageSize),
      (error) => console.error('Error fetching searched delivery products:', error)
    );
  }

  scheduleDelivery() {
    const selectedItems = this.deliveryProducts.filter(product => product.selected);
    this.scheduleDeliveryService.updateTransferDate(selectedItems, this.selectedDate).subscribe(
      () => this.getDeliveryProducts(),
      (error) => console.error('Error updating transfer date:', error)
    );
  }

  
  

  sendTermsAndConditions() {
    console.log('Terms and conditions sent.');
  }

  sortTable(property: keyof DeliveryProduct) {
    if (this.sortColumn === property) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = property;
      this.sortDirection = 'asc';
    }
    this.deliveryProducts.sort((a, b) => {
      const valueA = a[property];
      const valueB = b[property];
      if (valueA === undefined && valueB === undefined) return 0;
      if (valueA === undefined) return this.sortDirection === 'asc' ? 1 : -1;
      if (valueB === undefined) return this.sortDirection === 'asc' ? -1 : 1;
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return this.sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }
      return this.sortDirection === 'asc' ? (valueA < valueB ? -1 : 1) : (valueA > valueB ? -1 : 1);
    });
    this.updatePagination();
  }

  selectAll(event: any) {
    this.deliveryProducts.forEach(product => product.selected = event.target.checked);
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.deliveryProducts.length / this.pageSize);
    this.paginatedDeliveryProducts = this.deliveryProducts.slice(
      (this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize
    );
  }

  incrementPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  decrementPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }
}
