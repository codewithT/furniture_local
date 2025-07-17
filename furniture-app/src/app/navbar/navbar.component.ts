import { CommonModule } from '@angular/common';
import { Component, OnInit, HostListener, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { createIcons, icons } from 'lucide';
import { ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { Subscription } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('200ms ease-in', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-out', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class NavbarComponent implements OnInit, OnDestroy {
  @ViewChild('navContainer', { static: true }) navContainer!: ElementRef;
  @ViewChild('navLinks', { static: true }) navLinks!: ElementRef;
  
  isUserDropdownOpen = false;
  isDropdownOpen = false;
  isLoggedIn = false;
  isMobileMenuOpen = false;
  isMobileMode = false;
  environment = environment;
  currentUser: string = "";
  
  private authSubscription?: Subscription;
  private routerSubscription?: Subscription;

  constructor(
    private cdRef: ChangeDetectorRef, 
    private router: Router,
    public authService: AuthService
  ) {
    this.currentUser = this.authService.getCurrentUser()?.email || "";
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.checkScreenSize();
  }

  @HostListener('document:click', ['$event'])
  onClick(event: Event): void {
    const target = event.target as HTMLElement;
    
    // Close user dropdown when clicking outside
    const userDropdown = document.querySelector('.user-dropdown') as HTMLElement;
    const userToggle = document.querySelector('.user-dropdown .dropdown-toggle') as HTMLElement;
    
    if (userDropdown && !userDropdown.contains(target) && this.isUserDropdownOpen) {
      this.isUserDropdownOpen = false;
      this.cdRef.detectChanges();
    }

    // Close orders dropdown when clicking outside
    const ordersDropdown = document.querySelector('.dropdown:not(.user-dropdown)') as HTMLElement;
    const ordersToggle = document.querySelector('.dropdown:not(.user-dropdown) .dropdown-toggle') as HTMLElement;
    
    if (ordersDropdown && !ordersDropdown.contains(target) && this.isDropdownOpen) {
      this.isDropdownOpen = false;
      this.cdRef.detectChanges();
    }

    // Close mobile menu when clicking outside (only in mobile view)
    const navLinks = this.navLinks?.nativeElement;
    const mobileToggle = document.querySelector('.mobile-toggle') as HTMLElement;
    
    if (this.isMobileMode && navLinks && mobileToggle && 
        !navLinks.contains(target) && 
        !mobileToggle.contains(target) && 
        this.isMobileMenuOpen) {
      this.isMobileMenuOpen = false;
      this.cdRef.detectChanges();
    }
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    // Close user dropdown when orders dropdown opens
    if (this.isDropdownOpen) {
      this.isUserDropdownOpen = false;
    }
    this.cdRef.detectChanges();
  }

  toggleUserDropdown(): void {
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
    // Close orders dropdown when user dropdown opens
    if (this.isUserDropdownOpen) {
      this.isDropdownOpen = false;
    }
    this.cdRef.detectChanges();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    // Close all dropdowns when mobile menu toggles
    if (this.isMobileMenuOpen) {
      this.isDropdownOpen = false;
      this.isUserDropdownOpen = false;
    }
    this.cdRef.detectChanges();
  }

  checkScreenSize(): void {
    // Updated breakpoint for better iPad handling
    this.isMobileMode = window.innerWidth <= 1024;
    
    if (!this.isMobileMode) {
      this.isMobileMenuOpen = false;
      this.isDropdownOpen = false;
      this.isUserDropdownOpen = false;
    }
    this.cdRef.detectChanges();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
    this.closeAllDropdowns();
  }

  goToAdminPanel(): void {
    this.router.navigate(['/u/admin']);
    this.closeAllDropdowns();
  }

  login(): void {
    this.router.navigate(['/auth/login']);
    this.closeAllDropdowns();
  }

  goToChangePassword(): void {
    this.router.navigate(['/u/change-password']);
    this.closeAllDropdowns();
  }

  closeAllDropdowns(): void {
    this.isUserDropdownOpen = false;
    this.isDropdownOpen = false;
    if (this.isMobileMode) {
      this.isMobileMenuOpen = false;
    }
    this.cdRef.detectChanges();
  }

  closeMobile(): void {
    if (this.isMobileMode) {
      this.isMobileMenuOpen = false;
      this.isDropdownOpen = false;
      this.isUserDropdownOpen = false;
      this.cdRef.detectChanges();
    }
  }

  ngOnInit(): void {
    createIcons({ icons });
    this.checkScreenSize();
    
    this.authSubscription = this.authService.isAuthenticated$.subscribe((loggedIn) => {
      this.isLoggedIn = loggedIn;
      this.currentUser = this.authService.getCurrentUser()?.email || "";
      this.cdRef.detectChanges();
    });
    
    this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.closeAllDropdowns();
      }
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
  }

  isLoginPage(): boolean {
    return this.router.url.includes('/auth/login');
  }
}