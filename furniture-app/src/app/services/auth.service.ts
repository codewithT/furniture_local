import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiBaseUrl}/auth`;

  private isAuthenticated = new BehaviorSubject<boolean>(this.hasStoredUser());
  private userSubject = new BehaviorSubject<any>(this.getStoredUser());

  isAuthenticated$ = this.isAuthenticated.asObservable();
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.checkLoginState(); // auto-check on startup
  }

  private hasStoredUser(): boolean {
    return !!sessionStorage.getItem('user_data');
  }

  private getStoredUser(): any {
    const userData = sessionStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  }

  //  Login
  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password }, { withCredentials: true }).pipe(
      tap(response => {
        if (response?.user) {
          this.setUser(response.user);
        }
      }),
      catchError(error => {
        console.error('Login error:', error);
        throw error;
      })
    );
  }

  //  Logout
  logout(): void {
    this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .subscribe({
        next: () => this.handleLogout(),
        error: () => this.handleLogout()
      });
  }

  private handleLogout(): void {
    this.clearLocalData();
    this.router.navigate(['/auth/login']);
  }

  private clearLocalData(): void {
    sessionStorage.removeItem('user_data');
    this.isAuthenticated.next(false);
    this.userSubject.next(null);
  }

  //  Session check on app init / refresh
  checkLoginState(): void {
    this.http.get<{ isAuthenticated: boolean; user?: any }>(`${this.apiUrl}/is-authenticated`, { withCredentials: true })
      .subscribe({
        next: res => {
          if (res.isAuthenticated && res.user) {
            this.setUser(res.user);
          } else {
            this.clearLocalData();
          }
        },
        error: err => {
          console.error("Auth check error:", err);
          this.clearLocalData();
        }
      });
  }

  //  Utility methods
  isLoggedIn(): boolean {
    return this.isAuthenticated.getValue();
  }

  getCurrentUser(): any {
    // console.log('Current user:', this.userSubject.getValue());
    return this.userSubject.getValue();
  }

  //  Set user manually (used in AuthGuard or login)
  setUser(user: any): void {
    sessionStorage.setItem('user_data', JSON.stringify(user));
    this.userSubject.next(user);
    this.isAuthenticated.next(true);
  }

  // Role utilities 
  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    // console.log('Checking role:', role, 'for user:', user);
    return user?.roles?.includes(role);
  }
  getAllRoles(): string[] {
    const user = this.getCurrentUser();
    // console.log('Getting all roles for user:', user);
    return user?.roles || [];
  }
 hasAnyRole(roles: string[]): boolean {
  const userRoles = this.getAllRoles();
  return roles.some(role => userRoles.includes(role));
}
navigateByRole(roles: string[]): void {

  if(!roles || roles.length === 0) {
  const userRoles = this.getAllRoles();
  if (userRoles.includes('admin')) {
    this.router.navigate(['/u/dashboard']);
  } else if (userRoles.includes('purchase')) {
    this.router.navigate(['/u/purchase']);
  } else if (userRoles.includes('warehouse')) {
    this.router.navigate(['/u/receive']);
  } else if (userRoles.includes('sales')) {
    this.router.navigate(['/u/addOrders']);
  }
  else {
    this.router.navigate(['/u/unauthorized']);
  }
}
}


}
