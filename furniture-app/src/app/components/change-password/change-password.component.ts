import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChangePasswordService } from '../../services/changePassword.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-change-password',
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css'
})
export class ChangePasswordComponent {
 currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  message = '';
  router: any;

  constructor(private http: HttpClient,
    private changePasswordService: ChangePasswordService
  ) {}

  changePassword() {
    if (this.newPassword !== this.confirmPassword) {
      this.message = 'New passwords do not match';
      return;
    }
    if (!this.currentPassword || !this.newPassword) {
      this.message = 'Please fill in all fields';
      return;
    }

    this.changePasswordService.changePassword(this.currentPassword, this.newPassword)
      .subscribe({
        next: (response) => {
          this.message = 'Password changed successfully';
          // Optionally, redirect
          setTimeout(() => this.router.navigate(['/auth/login']), 5000);
        },
        error: (error) => {
          this.message = 'Error changing password';
        }
      });
  }
}
