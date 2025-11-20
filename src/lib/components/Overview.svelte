<script>
  import { onMount } from "svelte";
  import { collection, getDocs } from "firebase/firestore";
  import { db } from "../services/firebase";
  import { authStore } from "../../stores/auth";
  import { fade, fly, scale } from "svelte/transition";
  import { quintOut, cubicOut } from "svelte/easing";
  import { dataCache } from "../utils/dataCache";

  let totalEmployees = 0;
  let presentToday = 0;
  let lateToday = 0;
  let onTimeToday = 0;
  let loading = true;
  let userName = "";
  let currentTime = new Date();
  let greeting = "";

  // Update time every second
  let timeInterval;

  onMount(() => {
    loadStats();
    userName = $authStore.userData?.name || "Admin";
    updateGreeting();

    timeInterval = setInterval(() => {
      currentTime = new Date();
      updateGreeting();
    }, 1000);

    return () => {
      if (timeInterval) clearInterval(timeInterval);
    };
  });

  function updateGreeting() {
    const hour = currentTime.getHours();
    if (hour < 12) {
      greeting = "Good Morning";
    } else if (hour < 18) {
      greeting = "Good Afternoon";
    } else {
      greeting = "Good Evening";
    }
  }

  async function fetchDashboardStats() {
    const employeesSnap = await getDocs(collection(db, "pegawai"));
    const total = employeesSnap.size;

    if (employeesSnap.empty) {
      return {
        totalEmployees: 0,
        presentToday: 0,
        lateToday: 0,
        onTimeToday: 0,
      };
    }

    const today = new Date().toISOString().split("T")[0];
    let present = 0;
    let late = 0;

    for (const empDoc of employeesSnap.docs) {
      const presenceRef = collection(db, "pegawai", empDoc.id, "presence");
      const presenceSnap = await getDocs(presenceRef);

      presenceSnap.forEach((presDoc) => {
        const data = presDoc.data();
        if (data.date) {
          const presenceDate = data.date.split("T")[0];
          if (presenceDate === today) {
            present++;
            if (data.masuk && data.masuk.date) {
              const checkIn = new Date(data.masuk.date);
              if (
                checkIn.getHours() > 8 ||
                (checkIn.getHours() === 8 && checkIn.getMinutes() > 30)
              ) {
                late++;
              }
            }
          }
        }
      });
    }

    return {
      totalEmployees: total,
      presentToday: present,
      lateToday: late,
      onTimeToday: present - late,
    };
  }

  async function loadStats(forceRefresh = false) {
    loading = true;
    try {
      if (forceRefresh) {
        dataCache.invalidate("dashboard-stats");
      }

      // Use cache with 2 minute expiry (120000ms)
      const stats = await dataCache.getData(
        "dashboard-stats",
        fetchDashboardStats,
        120000
      );

      totalEmployees = stats.totalEmployees;
      presentToday = stats.presentToday;
      lateToday = stats.lateToday;
      onTimeToday = stats.onTimeToday;
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      loading = false;
    }
  }

  function formatTime(date) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  $: attendanceRate =
    totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  <!-- Welcome Banner -->
  <div
    class="welcome-banner"
    in:fly={{ y: -20, duration: 800, easing: quintOut }}
  >
    <div class="banner-content">
      <div class="banner-left">
        <div class="banner-icon">
          <svg
            class="w-10 h-10 text-white"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div>
          <h1 class="banner-title">{greeting}, {userName}</h1>
          <p class="banner-subtitle">{formatDate(currentTime)}</p>
        </div>
      </div>
      <div class="time-display">
        <svg
          class="w-5 h-5 text-white/80 mb-1"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <div class="time-value">{formatTime(currentTime)}</div>
      </div>
    </div>
  </div>

  <!-- Quick Stats Grid -->
  <div class="stats-grid">
    <!-- Total Employees -->
    <div
      class="stat-card"
      style="background: linear-gradient(135deg, #1A4786 0%, #3A7AE0 100%);"
      in:fly={{ y: 20, duration: 600, delay: 100, easing: quintOut }}
    >
      <div class="stat-header">
        <div class="stat-icon-wrapper">
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </div>
        <span class="stat-label">Total Employees</span>
      </div>
      <div class="stat-value">{loading ? "..." : totalEmployees}</div>
    </div>

    <!-- Present Today -->
    <div
      class="stat-card"
      style="background: linear-gradient(135deg, #059669 0%, #10b981 100%);"
      in:fly={{ y: 20, duration: 600, delay: 200, easing: quintOut }}
    >
      <div class="stat-header">
        <div class="stat-icon-wrapper">
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <span class="stat-label">Present Today</span>
      </div>
      <div class="stat-value">{loading ? "..." : presentToday}</div>
      <div class="stat-footer">{attendanceRate}% attendance rate</div>
    </div>

    <!-- On Time -->
    <div
      class="stat-card"
      style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);"
      in:fly={{ y: 20, duration: 600, delay: 300, easing: quintOut }}
    >
      <div class="stat-header">
        <div class="stat-icon-wrapper">
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <span class="stat-label">On Time</span>
      </div>
      <div class="stat-value">{loading ? "..." : onTimeToday}</div>
    </div>

    <!-- Late Check-ins -->
    <div
      class="stat-card"
      style="background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);"
      in:fly={{ y: 20, duration: 600, delay: 400, easing: quintOut }}
    >
      <div class="stat-header">
        <div class="stat-icon-wrapper">
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <span class="stat-label">Late Today</span>
      </div>
      <div class="stat-value">{loading ? "..." : lateToday}</div>
    </div>
  </div>

  <!-- Info Cards Grid -->
  <div class="info-grid">
    <!-- Today's Summary -->
    <div
      class="info-card"
      in:fly={{ x: -20, duration: 600, delay: 500, easing: quintOut }}
    >
      <div class="card-header">
        <h3 class="card-title">Today's Summary</h3>
        <button
          on:click={() => loadStats(true)}
          class="refresh-btn"
          title="Refresh data"
          disabled={loading}
        >
          <svg
            class="w-5 h-5 {loading ? 'animate-spin' : ''}"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"
            ></path>
          </svg>
        </button>
      </div>
      <div class="card-content">
        <div class="summary-row">
          <div
            class="summary-icon"
            style="background: rgba(58, 122, 224, 0.1);"
          >
            <svg
              class="w-5 h-5"
              style="color: #3A7AE0;"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              ></path>
            </svg>
          </div>
          <div class="summary-text">
            <span class="summary-label">Active Employees</span>
            <span class="summary-value">{totalEmployees}</span>
          </div>
        </div>

        <div class="summary-row">
          <div
            class="summary-icon"
            style="background: rgba(16, 185, 129, 0.1);"
          >
            <svg
              class="w-5 h-5"
              style="color: #10b981;"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="summary-text">
            <span class="summary-label">Attendance Rate</span>
            <span class="summary-value">{attendanceRate}%</span>
          </div>
        </div>

        <div class="summary-row">
          <div
            class="summary-icon"
            style="background: rgba(255, 215, 0, 0.15);"
          >
            <svg
              class="w-5 h-5"
              style="color: #FFD700;"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              ></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div class="summary-text">
            <span class="summary-label">Late Arrivals</span>
            <span class="summary-value">{lateToday}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Tips -->
    <div
      class="info-card"
      in:fly={{ x: 20, duration: 600, delay: 500, easing: quintOut }}
    >
      <div class="card-header">
        <h3 class="card-title">Quick Tips</h3>
      </div>
      <div class="card-content">
        <div class="tip-row">
          <div class="tip-icon" style="background: rgba(58, 122, 224, 0.1);">
            <svg
              class="w-5 h-5"
              style="color: #3A7AE0;"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div class="tip-text">
            <span class="tip-title">Data is cached</span>
            <span class="tip-desc"
              >Stats refresh automatically every 2 minutes to save resources</span
            >
          </div>
        </div>

        <div class="tip-row">
          <div class="tip-icon" style="background: rgba(16, 185, 129, 0.1);">
            <svg
              class="w-5 h-5"
              style="color: #10b981;"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
              ></polygon>
            </svg>
          </div>
          <div class="tip-text">
            <span class="tip-title">Quick Navigation</span>
            <span class="tip-desc"
              >Use the top menu to switch between different sections</span
            >
          </div>
        </div>

        <div class="tip-row">
          <div class="tip-icon" style="background: rgba(6, 182, 212, 0.1);">
            <svg
              class="w-5 h-5"
              style="color: #06b6d4;"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
              ></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div class="tip-text">
            <span class="tip-title">View Details</span>
            <span class="tip-desc"
              >Check Attendance tab for detailed records and reports</span
            >
          </div>
        </div>

        <div class="tip-row">
          <div class="tip-icon" style="background: rgba(255, 215, 0, 0.15);">
            <svg
              class="w-5 h-5"
              style="color: #FFD700;"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"
              ></path>
            </svg>
          </div>
          <div class="tip-text">
            <span class="tip-title">Manual Refresh</span>
            <span class="tip-desc"
              >Click the refresh button to get the latest data</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Welcome Banner */
  .welcome-banner {
    background: linear-gradient(135deg, #1a4786 0%, #3a7ae0 100%);
    border-radius: 1rem;
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(26, 71, 134, 0.1);
  }

  .banner-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .banner-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .banner-icon {
    width: 4rem;
    height: 4rem;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .banner-title {
    font-size: 1.875rem;
    font-weight: 700;
    color: white;
    margin: 0 0 0.25rem 0;
    line-height: 1.2;
  }

  .banner-subtitle {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
  }

  .time-display {
    background: rgba(255, 255, 255, 0.15);
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .time-value {
    font-size: 2rem;
    font-weight: 700;
    color: white;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.25rem;
  }

  .stat-card {
    border-radius: 0.75rem;
    padding: 1.5rem;
    color: white;
    box-shadow: 0 1px 3px rgba(26, 71, 134, 0.1);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(26, 71, 134, 0.15);
  }

  .stat-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .stat-icon-wrapper {
    width: 2.5rem;
    height: 2.5rem;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .stat-label {
    font-size: 0.875rem;
    font-weight: 500;
    opacity: 0.95;
  }

  .stat-value {
    font-size: 2.25rem;
    font-weight: 700;
    line-height: 1;
  }

  .stat-footer {
    font-size: 0.75rem;
    margin-top: 0.5rem;
    opacity: 0.85;
  }

  /* Info Cards */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.25rem;
  }

  .info-card {
    background: white;
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(26, 71, 134, 0.1);
    border: 1px solid #f8f8f8;
  }

  .card-header {
    padding: 1.25rem 1.5rem;
    background: #f8f8f8;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-title {
    font-size: 1rem;
    font-weight: 700;
    color: #1a4786;
    margin: 0;
  }

  .refresh-btn {
    padding: 0.5rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    color: #3a7ae0;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-btn:hover:not(:disabled) {
    background: rgba(58, 122, 224, 0.1);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .card-content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Summary Rows */
  .summary-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem;
    background: #f8f8f8;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
  }

  .summary-row:hover {
    background: rgba(58, 122, 224, 0.05);
    transform: translateX(4px);
  }

  .summary-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .summary-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
  }

  .summary-label {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .summary-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: #1a4786;
  }

  /* Tip Rows */
  .tip-row {
    display: flex;
    gap: 0.875rem;
    padding: 0.875rem;
    background: #f8f8f8;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
  }

  .tip-row:hover {
    background: rgba(58, 122, 224, 0.05);
    transform: translateX(4px);
  }

  .tip-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .tip-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .tip-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a4786;
  }

  .tip-desc {
    font-size: 0.75rem;
    color: #6b7280;
    line-height: 1.4;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @media (max-width: 768px) {
    .banner-title {
      font-size: 1.5rem;
    }

    .time-value {
      font-size: 1.5rem;
    }

    .stat-value {
      font-size: 1.875rem;
    }
  }
</style>
