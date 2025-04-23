import { CommonModule } from '@angular/common';
import { Component, OnInit, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, RouterOutlet, RouterModule } from '@angular/router';
import { createIcons, icons } from 'lucide'; // Import icons object
import { ChangeDetectorRef } from '@angular/core'; // Import ChangeDetectorRef
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  isUserDropdownOpen = false;
  isDropdownOpen = false;
  isLoggedIn = false;
  isMobileMenuOpen = false;
  mobileView = false;
  environment = environment; // Bind environment variable

  constructor(
    private cdRef: ChangeDetectorRef, 
    private router: Router,
    private authService: AuthService
  ) {}

  // Check screen size on window resize
  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  // Check for clicks outside the dropdown menus
  @HostListener('document:click', ['$event'])
  onClick(event: any) {
    // Close user dropdown when clicking outside
    const userDropdown = document.querySelector('.user-dropdown');
    if (userDropdown && !userDropdown.contains(event.target) && this.isUserDropdownOpen) {
      this.isUserDropdownOpen = false;
      userDropdown.classList.remove('active');
    }

    // Close orders dropdown when clicking outside (only in mobile view)
    if (this.mobileView) {
      const ordersDropdown = document.querySelector('.dropdown');
      if (ordersDropdown && !ordersDropdown.contains(event.target) && this.isDropdownOpen) {
        this.isDropdownOpen = false;
      }
    }

    // Don't close mobile menu when clicking inside it
    const navLinks = document.querySelector('.nav-links');
    const mobileToggle = document.querySelector('.mobile-nav-toggle');
    if (navLinks && mobileToggle && 
        !navLinks.contains(event.target) && 
        !mobileToggle.contains(event.target) && 
        this.isMobileMenuOpen) {
      this.isMobileMenuOpen = false;
    }
  }

  // Toggle main dropdown menu
  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
    // In desktop view, close after a short delay to allow navigation
    if (!this.mobileView && this.isDropdownOpen) {
      setTimeout(() => {
        this.isDropdownOpen = false;
        this.cdRef.detectChanges();
      }, 2000);
    }
  }

  // Toggle user profile dropdown
  toggleUserDropdown() {
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
    const dropdown = document.querySelector('.user-dropdown');
    if (this.isUserDropdownOpen) {
      dropdown?.classList.add('active');
    } else {
      dropdown?.classList.remove('active');
    }
  }

  // Toggle mobile menu
  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    const navLinks = document.querySelector('.nav-links');
    if (this.isMobileMenuOpen) {
      navLinks?.classList.add('active');
    } else {
      navLinks?.classList.remove('active');
      // Close dropdowns when closing the mobile menu
      this.isDropdownOpen = false;
      this.isUserDropdownOpen = false;
      const userDropdown = document.querySelector('.user-dropdown');
      userDropdown?.classList.remove('active');
    }
  }

  // Check screen size and adjust UI accordingly
  checkScreenSize() {
    this.mobileView = window.innerWidth <= 768;
    if (!this.mobileView) {
      this.isMobileMenuOpen = false;
      const navLinks = document.querySelector('.nav-links');
      navLinks?.classList.remove('active');
    }
    this.cdRef.detectChanges();
  }

  logout() {
    this.authService.logout(); // Call logout method
    this.router.navigate([`/auth/login`]);
    this.isUserDropdownOpen = false;
    const dropdown = document.querySelector('.user-dropdown');
    dropdown?.classList.remove('active');
  }

  login() {
    this.router.navigate([`/auth/login`]);
    this.isUserDropdownOpen = false;
    const dropdown = document.querySelector('.user-dropdown');
    dropdown?.classList.remove('active');
  }

  // Close mobile menu on navigation
  closeMenuOnNavigation() {
    if (this.mobileView) {
      this.isMobileMenuOpen = false;
      const navLinks = document.querySelector('.nav-links');
      navLinks?.classList.remove('active');
      this.isDropdownOpen = false;
      this.isUserDropdownOpen = false;
      const userDropdown = document.querySelector('.user-dropdown');
      userDropdown?.classList.remove('active');
    }
  }

  ngOnInit() {
    createIcons({icons});
    
    // Check screen size on init
    this.checkScreenSize();
    
    // Subscribe to authentication status
    this.authService.isAuthenticated$.subscribe((loggedIn) => {
      this.isLoggedIn = loggedIn;
      this.cdRef.detectChanges(); // Ensure UI updates
    });
    
    // Close menu when navigation occurs
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.closeMenuOnNavigation();
      }
    });
  }

  // Function to check if the current route is the login page
  isLoginPage(): boolean {
    return this.router.url.includes('/auth/login');
  }
}