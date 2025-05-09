import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiBaseUrl}/auth`; 
  
  // Track authentication state
  private isAuthenticated = new BehaviorSubject<boolean>(this.hasStoredUser());
  private userSubject = new BehaviorSubject<any>(this.getStoredUser());
  
  isAuthenticated$ = this.isAuthenticated.asObservable();
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    // Check auth state immediately when service is created
    this.checkLoginState();
  }

  // Helper method to check if user exists in storage
  private hasStoredUser(): boolean {
    return !!sessionStorage.getItem('user_data');
  }

  // Helper method to get stored user
  private getStoredUser(): any {
    const userData = sessionStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/login`, 
      { email, password }, 
      { withCredentials: true }
    ).pipe(
      tap(response => {
        if (response && response.user) {
          // Store user data locally
          sessionStorage.setItem('user_data', JSON.stringify(response.user));
          this.userSubject.next(response.user);
          this.isAuthenticated.next(true);
        }
      }),
      catchError(error => {
        console.error('Login error:', error);
        throw error;
      })
    );
  }

  logout(): void {
    this.clearLocalData();
    
    // Call logout API
    this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .subscribe({
        next: () => this.handleLogout(),
        error: () => this.handleLogout() // Still logout on client side even if API fails
      });
  }
  
  private handleLogout(): void {
    // Clear local storage
    sessionStorage.removeItem('user_data');
    
    // Update state
    this.isAuthenticated.next(false);
    this.userSubject.next(null);
    
    // Navigate to login page
    this.router.navigate(['/auth/login']);
  }

  checkLoginState(): void {
    this.http.get<{ isAuthenticated: boolean; user?: any }>(
      `${this.apiUrl}/is-authenticated`, 
      { withCredentials: true }
    ).subscribe({
      next: response => {
        console.log("🔍 Authentication check response:", response);
        this.isAuthenticated.next(response.isAuthenticated);
        
        if (response.isAuthenticated && response.user) {
          sessionStorage.setItem('user_data', JSON.stringify(response.user));
          this.userSubject.next(response.user);
        } else {
          this.clearLocalData();
        }
      },
      error: (err) => {
        console.error("🚨 Authentication check error:", err);
        this.clearLocalData();
      }
    });
  }
  
  private clearLocalData(): void {
    sessionStorage.removeItem('user_data');
    this.isAuthenticated.next(false);
    this.userSubject.next(null);
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated.getValue();
  }
  
  getCurrentUser(): any {
    const user = this.userSubject.getValue();
    if (!user) return null;
    
    // Check if user is directly the user object or has a user property
    return user.email ? user : user.user;
  }
}