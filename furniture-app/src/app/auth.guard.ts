import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from './services/auth.service';
import { take, map, catchError, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}
  
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
    // Make a direct HTTP request to check auth status
    this.authService.checkLoginState();
    
    // Use the authentication observable to determine access
    return this.authService.isAuthenticated$.pipe(
      take(1), // Only take the first emission after the check
      tap(isAuth => console.log("AuthGuard - Authentication state after server check:", isAuth)),
      map(isAuthenticated => {
        if (isAuthenticated) {
          return true;
        } else {
          console.log("AuthGuard - Not authenticated, redirecting to login.");
          this.router.navigate(['/auth/login']);
          return false;
        }
      }),
      catchError(() => {
        console.log("AuthGuard - Error checking authentication, redirecting to login.");
        this.router.navigate(['/auth/login']);
        return of(false);
      })
    );
  }
}