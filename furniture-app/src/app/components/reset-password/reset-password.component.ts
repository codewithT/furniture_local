import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ForgotPasswordService } from '../../services/forgotPassword.service';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, CommonModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent {
  password = '';
  confirmPassword = '';
  token = '';
  message = '';

  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router,
    private forgotPasswordService: ForgotPasswordService
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
  }

  resetPassword() {
    if (this.password !== this.confirmPassword) {
      this.message = 'Passwords do not match.';
      return;
    }
    if (!this.token) {
      this.message = 'Invalid reset token.';
      return;
    }
    console.log(this.password);
    this.forgotPasswordService.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.message = 'Password reset successful.';
        setTimeout(() => this.router.navigate(['/login']), 3000);
      },
      error: () => this.message = 'Reset failed or token expired.'
    });
  }
}
