import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from './services/auth.service';
import { take, map, catchError, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router, 
    private http: HttpClient
  ) {}
  private apiUrl = `${environment.apiBaseUrl}/auth`; 
  canActivate(): Observable<boolean> {
    console.log("AuthGuard - Checking authentication status...");

    // If already authenticated via service state, allow access
    if (this.authService.isLoggedIn()) {
      console.log("AuthGuard - Already authenticated in service");
      return of(true);
    }

    // Force a server check to verify authentication
    return this.checkServerAuthentication();
  }
  private checkServerAuthentication(): Observable<boolean> {
    // Force a new check with the server
    return this.http.get<{isAuthenticated: boolean}>(`${this.apiUrl}/is-authenticated`, 
      { withCredentials: true }).pipe(
      take(1),
      map(response => {
        if (response.isAuthenticated) {
          return true;
        } else {
          this.router.navigate(['/auth/login']);
          return false;
        }
      }),
      catchError(() => {
        this.router.navigate(['/auth/login']);
        return of(false);
      })
    );
  }

   
}