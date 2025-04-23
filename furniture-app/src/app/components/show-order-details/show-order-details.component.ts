import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-show-order-details',
  imports: [ MatDialogModule,
    MatButtonModule,
    MatCardModule,
    CommonModule],
  templateUrl: './show-order-details.component.html',
  styleUrls: ['./show-order-details.component.css']
})
export class ShowOrderDetailsComponent {
  constructor(
    public dialogRef: MatDialogRef<ShowOrderDetailsComponent>,
    @Inject(MAT_DIALOG_DATA) public order: any
  ) {}

  closeDialog(): void {
    this.dialogRef.close();
  }
}
