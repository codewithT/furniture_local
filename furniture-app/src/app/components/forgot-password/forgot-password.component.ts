import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { ForgotPasswordService } from '../../services/forgotPassword.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  email = '';
  message = '';
  constructor(private http: HttpClient,
              private forgotPasswordService: ForgotPasswordService
  ) {}

  sendResetLink() {
    this.forgotPasswordService.forgotPassword(this.email).subscribe({
      next: () => this.message = 'If your email exists, a reset link has been sent.',
      error: () => this.message = 'Error sending reset link.'
    });
  }
}
