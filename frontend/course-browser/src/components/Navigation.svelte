<!-- src/components/Navigation.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let currentView: string = 'courses';
  export let isSignedIn: boolean = false;
  export let userName: string = '';
  
  const dispatch = createEventDispatcher();
  
  let mobileMenuOpen = false;
  
  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }
  
  function handleNavigation(view: string) {
    dispatch('navigate', view);
    mobileMenuOpen = false;
  }
  
  function handleSignIn() {
    dispatch('signin');
    mobileMenuOpen = false;
  }
  
  function handleSignOut() {
    dispatch('signout');
    mobileMenuOpen = false;
  }
</script>

<nav class="navbar">
  <div class="nav-container">
    <!-- Logo/Brand -->
    <div class="nav-brand">
      <button class="brand-link" on:click={() => handleNavigation('courses')}>
        <span class="brand-name">Sisukas</span>
        <span class="brand-tagline">since 2025</span>
      </button>
    </div>
    
    <!-- Desktop Navigation -->
    <div class="nav-links">
      <button 
        class="nav-link" 
        class:active={currentView === 'courses'}
        on:click={() => handleNavigation('courses')}
      >
        <i class="bi bi-search"></i>
        <span>Browse Courses</span>
      </button>
      
      <button 
        class="nav-link" 
        class:active={currentView === 'saved'}
        on:click={() => handleNavigation('saved')}
      >
        <i class="bi bi-bookmark"></i>
        <span>Saved Filters</span>
      </button>
      
      <button 
        class="nav-link" 
        class:active={currentView === 'about'}
        on:click={() => handleNavigation('about')}
      >
        <i class="bi bi-info-circle"></i>
        <span>About</span>
      </button>
    </div>
    
    <!-- User Section -->
    <div class="nav-user">
      {#if isSignedIn}
        <div class="user-menu">
          <button class="nav-link user-link">
            <i class="bi bi-person-circle"></i>
            <span>{userName}</span>
          </button>
          <button class="sign-out-btn" on:click={handleSignOut}>
            <i class="bi bi-box-arrow-right"></i>
            <span>Sign Out</span>
          </button>
        </div>
      {:else}
        <button class="sign-in-btn" on:click={handleSignIn}>
          <i class="bi bi-box-arrow-in-right"></i>
          <span>Sign In</span>
        </button>
      {/if}
    </div>
    
    <!-- Mobile Menu Toggle -->
    <button
      class="mobile-menu-toggle"
      on:click={toggleMobileMenu}
      aria-label="Toggle sort direction"
    >
      <i class="bi {mobileMenuOpen ? 'bi-x' : 'bi-list'}"></i>
    </button>
  </div>
  
  <!-- Mobile Menu -->
  {#if mobileMenuOpen}
    <div class="mobile-menu">
      <button 
        class="mobile-nav-link" 
        class:active={currentView === 'courses'}
        on:click={() => handleNavigation('courses')}
      >
        <i class="bi bi-search"></i>
        <span>Browse Courses</span>
      </button>
      
      <button 
        class="mobile-nav-link" 
        class:active={currentView === 'saved'}
        on:click={() => handleNavigation('saved')}
      >
        <i class="bi bi-bookmark"></i>
        <span>Saved Filters</span>
      </button>
      
      <button 
        class="mobile-nav-link" 
        class:active={currentView === 'about'}
        on:click={() => handleNavigation('about')}
      >
        <i class="bi bi-info-circle"></i>
        <span>About</span>
      </button>
      
      <div class="mobile-divider"></div>
      
      {#if isSignedIn}
        <div class="mobile-user-info">
          <i class="bi bi-person-circle"></i>
          <span>{userName}</span>
        </div>
        <button class="mobile-nav-link sign-out" on:click={handleSignOut}>
          <i class="bi bi-box-arrow-right"></i>
          <span>Sign Out</span>
        </button>
      {:else}
        <button class="mobile-nav-link sign-in" on:click={handleSignIn}>
          <i class="bi bi-box-arrow-in-right"></i>
          <span>Sign In</span>
        </button>
      {/if}
    </div>
  {/if}
</nav>

<style>
  .navbar {
    background: white;
    border-bottom: 1px solid #ddd;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  
  .nav-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
  }
  
  /* Brand */
  .nav-brand {
    flex-shrink: 0;
  }
  
  .brand-link {
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0;
  }
  
  .brand-name {
    display: block;
    font-size: 1.5rem;
    font-weight: bold;
    color: #333;
  }
  
  .brand-tagline {
    display: block;
    font-size: 0.75rem;
    color: #888;
    margin-top: -4px;
  }
  
  /* Desktop Navigation Links */
  .nav-links {
    display: flex;
    gap: 0.5rem;
    flex: 1;
    justify-content: center;
  }
  
  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    color: #666;
    transition: all 0.2s;
  }
  
  .nav-link:hover {
    background: #f0f0f0;
    color: #333;
  }
  
  .nav-link.active {
    background: #4a90e2;
    color: white;
  }
  
  .nav-link i {
    font-size: 1.2rem;
  }
  
  /* User Section */
  .nav-user {
    flex-shrink: 0;
  }
  
  .user-menu {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .user-link {
    color: #666;
  }

  .user-link i {
    color: #4a90e2;
  }

  .user-link:hover {
    background: #f0f0f0;
    color: #333;
  }
  
  .sign-in-btn,
  .sign-out-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.2rem;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
  }
  
  .sign-in-btn:hover,
  .sign-out-btn:hover {
    background: #357abd;
  }
  
  .sign-out-btn {
    background: #dc3545;
  }
  
  .sign-out-btn:hover {
    background: #c82333;
  }
  
  /* Mobile Menu Toggle */
  .mobile-menu-toggle {
    display: none;
    background: none;
    border: none;
    font-size: 1.8rem;
    cursor: pointer;
    color: #333;
    padding: 0.5rem;
  }
  
  /* Mobile Menu */
  .mobile-menu {
    display: none;
    flex-direction: column;
    padding: 1rem;
    background: white;
    border-top: 1px solid #ddd;
  }
  
  .mobile-nav-link {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.6rem;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    color: #666;
    text-align: left;
    transition: background 0.2s;
  }
  
  .mobile-nav-link:hover {
    background: #f0f0f0;
  }
  
  .mobile-nav-link.active {
    background: #4a90e2;
    color: white;
  }
  
  .mobile-divider {
    height: 1px;
    background: #ddd;
    margin: 0.5rem 0;
  }

  .mobile-user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 0.6rem;
    color: #333;
    font-weight: 400;
    font-size: 1.1rem;
    word-break: break-all;
  }

  .mobile-user-info i {
    font-size: 1.8rem;
    color: #4a90e2;
    flex-shrink: 0;
  }

  .mobile-nav-link {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.8rem 0.6rem;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1.1rem;
    color: #666;
    text-align: left;
    transition: background 0.2s;
  }
  
  .mobile-nav-link.sign-in {
    background: #4a90e2;
    color: white;
    margin-top: 0.5rem;
  }
  
  .mobile-nav-link.sign-out {
    background: #dc3545;
    color: white;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .nav-links,
    .nav-user {
      display: none;
    }
    
    .mobile-menu-toggle {
      display: block;
    }
    
    .mobile-menu {
      display: flex;
    }
    
    .brand-tagline {
      display: none;
    }
  }
</style>