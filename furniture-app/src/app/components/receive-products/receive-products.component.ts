import { Component, OnInit } from '@angular/core';
import { ReceiveProductsService, ReceivedProduct } from '../../services/receive-products.service';
import { HttpClient } from '@angular/common/http';    
import { from } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-receive-products',
  imports: [ FormsModule, CommonModule],
  standalone: true,
  templateUrl: './receive-products.component.html',
  styleUrls: ['./receive-products.component.css']
})
export class ReceiveProductsComponent implements OnInit {
  receiveProducts: ReceivedProduct[] = [];

  constructor(private receiveProductsService: ReceiveProductsService) {}

  ngOnInit(): void {
    this.loadReceivedProducts();
  }

  loadReceivedProducts(): void {
    this.receiveProductsService.getReceivedProducts().subscribe({
      next: (products) => this.receiveProducts = products,
      error: (error) => console.error('Error fetching received products', error)
    });
  }

  updateStatus(product : any){
     this.receiveProductsService.updateStatus(product).subscribe({
      next: (response : any) => { 
        alert('Status updated successfully');
        console.log('Status updated successfully', response);
        this.loadReceivedProducts(); // Reload the products after updating status
      }
      , error: (error) => console.error('Error updating status', error) 
    });
  }

  printDetails(received: ReceivedProduct): void {
    
    const printContent = `
      <h2>Product Receiving Details</h2>
      <p><strong>SO Number:</strong> ${received.SONumber || 'N/A'}</p>
      <p><strong>Customer Name:</strong> ${received.Customer_name || 'N/A'}</p>
      <p><strong>Customer Address:</strong> ${received.ShipToParty || 'N/A'}</p>
    `;
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(printContent);
      newWindow.document.close();
      newWindow.print();
    }
  }
}
