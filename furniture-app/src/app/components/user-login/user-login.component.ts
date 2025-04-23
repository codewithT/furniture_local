import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-user-login',
  standalone: true,
  imports: [ CommonModule, FormsModule, ReactiveFormsModule ],
  templateUrl: './user-login.component.html',
  styleUrls: ['./user-login.component.css']
})
export class UserLoginComponent implements OnInit {
  loginForm!: FormGroup;
  isSubmitted = false;
  loginError = '';
  isLoading = false;
  
  constructor(
    private fb: FormBuilder,
    private router: Router, 
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Initialize the reactive form
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
    
    // Check if user is already logged in
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.router.navigate(['/u/dashboard']);
      }
    });
  }
   
  onSubmit(): void {
    this.isSubmitted = true;
    this.loginError = '';
    
    if (this.loginForm.invalid) {
      return;
    }
    
    this.isLoading = true;
    const { email, password } = this.loginForm.value;
    
    // Call login() which returns an Observable, and subscribe to it.
    this.authService.login(email, password).subscribe({
      next: (response) => {
        console.log('Login successful:', response);
        this.isLoading = false;
        this.router.navigate(['/u/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Login error:', err);
        
        // Handle different error scenarios
        if (err.status === 400) {
          this.loginError = 'Invalid email or password.';
        } else if (err.status === 0) {
          this.loginError = 'Cannot connect to server. Please try again later.';
        } else {
          this.loginError = 'Login failed. Please try again.';
        }
      }
    });
  }
}