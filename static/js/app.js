// State Management
let releaseData = [];
let selectedUpdates = new Set(); // Stores ID strings of selected updates
let currentCategory = 'all';
let currentDomain = 'all';
let searchQuery = '';
let tweetStyle = 'digest'; // 'digest', 'bullet', 'simple'

// DOM Elements
const elements = {
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    totalUpdatesCount: document.getElementById('totalUpdatesCount'),
    featuresCount: document.getElementById('featuresCount'),
    issuesCount: document.getElementById('issuesCount'),
    announcementsCount: document.getElementById('announcementsCount'),
    lastSyncTime: document.getElementById('lastSyncTime'),
    
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    categoryFilters: document.getElementById('categoryFilters'),
    selectionStatusBox: document.getElementById('selectionStatusBox'),
    clearSelectionBtn: document.getElementById('clearSelectionBtn'),
    
    selectAllVisibleBtn: document.getElementById('selectAllVisibleBtn'),
    errorAlert: document.getElementById('errorAlert'),
    errorMessage: document.getElementById('errorMessage'),
    feedSkeleton: document.getElementById('feedSkeleton'),
    emptyState: document.getElementById('emptyState'),
    feedContainer: document.getElementById('feedContainer'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    
    tweetDrawer: document.getElementById('tweetDrawer'),
    selectedCountBadge: document.getElementById('selectedCountBadge'),
    closeDrawerBtn: document.getElementById('closeDrawerBtn'),
    tweetTextarea: document.getElementById('tweetTextarea'),
    charCount: document.getElementById('charCount'),
    charLimit: document.getElementById('charLimit'),
    charWarning: document.getElementById('charWarning'),
    regenerateTweetBtn: document.getElementById('regenerateTweetBtn'),
    copyTweetBtn: document.getElementById('copyTweetBtn'),
    submitTweetBtn: document.getElementById('submitTweetBtn'),
    
    toastNotification: document.getElementById('toastNotification'),
    toastMessage: document.getElementById('toastMessage')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    fetchReleaseNotes();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
    }
}

function toggleTheme() {
    if (document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // Theme toggle
    elements.themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Refresh & sync
    elements.refreshBtn.addEventListener('click', fetchReleaseNotes);
    
    // Search
    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        elements.clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        applyFilters();
    });
    
    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        elements.searchInput.focus();
        applyFilters();
    });
    
    // Category chips selection
    elements.categoryFilters.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        
        // Remove active state from all chips
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        
        // Add active state to clicked chip
        chip.classList.add('active');
        
        currentCategory = chip.dataset.category;
        applyFilters();
    });
    
    // Domain chips selection
    const domainFilters = document.getElementById('domainFilters');
    if (domainFilters) {
        domainFilters.addEventListener('click', (e) => {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;
            
            domainFilters.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            currentDomain = chip.dataset.domain;
            applyFilters();
        });
    }
    
    // Reset filters empty state button
    elements.resetFiltersBtn.addEventListener('click', resetFilters);
    
    // Select all visible on feed
    elements.selectAllVisibleBtn.addEventListener('click', selectAllVisible);
    
    // Clear selection
    elements.clearSelectionBtn.addEventListener('click', clearAllSelections);
    
    // Tweet drawer controls
    elements.closeDrawerBtn.addEventListener('click', closeDrawer);
    
    // Tweet styles template buttons
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            tweetStyle = e.target.dataset.style;
            generateTweetDraft();
        });
    });
    
    elements.tweetTextarea.addEventListener('input', updateCharCount);
    elements.regenerateTweetBtn.addEventListener('click', generateTweetDraft);
    elements.copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    elements.submitTweetBtn.addEventListener('click', triggerTweetIntent);
}

// Fetch Notes API Call
async function fetchReleaseNotes() {
    setLoadingState(true);
    elements.errorAlert.style.display = 'none';
    
    try {
        const response = await fetch('/api/releases');
        const result = await response.json();
        
        if (result.success) {
            releaseData = result.data;
            updateStats();
            renderFeed();
            
            // Set sync timestamp
            const now = new Date();
            elements.lastSyncTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            showToast('Feed synced successfully!');
        } else {
            showError(result.error || 'Failed to fetch release notes.');
        }
    } catch (err) {
        showError('Network error connecting to Flask server: ' + err.message);
    } finally {
        setLoadingState(false);
    }
}

// Loading States UI toggle
function setLoadingState(isLoading) {
    if (isLoading) {
        elements.refreshBtn.classList.add('refreshing');
        elements.refreshBtn.disabled = true;
        elements.feedSkeleton.style.display = 'block';
        elements.feedContainer.style.display = 'none';
        elements.emptyState.style.display = 'none';
    } else {
        elements.refreshBtn.classList.remove('refreshing');
        elements.refreshBtn.disabled = false;
        elements.feedSkeleton.style.display = 'none';
    }
}

// Errors rendering
function showError(msg) {
    elements.errorMessage.textContent = msg;
    elements.errorAlert.style.display = 'flex';
    elements.feedSkeleton.style.display = 'none';
    elements.feedContainer.style.display = 'none';
    elements.emptyState.style.display = 'none';
}

// Toast System
function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toastNotification.classList.add('show');
    
    setTimeout(() => {
        elements.toastNotification.classList.remove('show');
    }, 3000);
}

// Reset Search and Categories filters
function resetFilters() {
    elements.searchInput.value = '';
    searchQuery = '';
    elements.clearSearchBtn.style.display = 'none';
    
    // Reset category filter active states
    elements.categoryFilters.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    elements.categoryFilters.querySelector('[data-category="all"]').classList.add('active');
    currentCategory = 'all';
    
    // Reset domain filter active states
    const domainFilters = document.getElementById('domainFilters');
    if (domainFilters) {
        domainFilters.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        domainFilters.querySelector('[data-domain="all"]').classList.add('active');
    }
    currentDomain = 'all';
    
    applyFilters();
}

// Calculate Stats for Sidebar & Top Bar
function updateStats() {
    let total = 0;
    let features = 0;
    let issues = 0;
    let announcements = 0;
    let others = 0;
    
    let domainAll = 0;
    let domainDE = 0;
    let domainDA = 0;
    let domainSE = 0;
    let domainCE = 0;
    let domainGT = 0;
    
    releaseData.forEach(entry => {
        entry.updates.forEach(up => {
            total++;
            const cat = normalizeCategory(up.type);
            if (cat === 'feature') features++;
            else if (cat === 'issue') issues++;
            else if (cat === 'announcement') announcements++;
            else others++;
            
            domainAll++;
            const domains = up.domains || [];
            if (domains.includes("Data Engineer")) domainDE++;
            if (domains.includes("Data Analyst")) domainDA++;
            if (domains.includes("Software Engineer")) domainSE++;
            if (domains.includes("Cloud Engineer")) domainCE++;
            if (domains.includes("General Technical") || domains.length === 0) domainGT++;
        });
    });
    
    // Update topbar badges
    elements.totalUpdatesCount.textContent = total;
    elements.featuresCount.textContent = features;
    elements.issuesCount.textContent = issues;
    elements.announcementsCount.textContent = announcements;
    
    // Update sidebar counts
    document.getElementById('countAll').textContent = total;
    document.getElementById('countFeature').textContent = features;
    document.getElementById('countIssue').textContent = issues;
    document.getElementById('countAnnouncement').textContent = announcements;
    document.getElementById('countOther').textContent = others;
    
    // Update domain sidebar counts
    const dAll = document.getElementById('countDomainAll');
    if (dAll) dAll.textContent = domainAll;
    const dDE = document.getElementById('countDomainDE');
    if (dDE) dDE.textContent = domainDE;
    const dDA = document.getElementById('countDomainDA');
    if (dDA) dDA.textContent = domainDA;
    const dSE = document.getElementById('countDomainSE');
    if (dSE) dSE.textContent = domainSE;
    const dCE = document.getElementById('countDomainCE');
    if (dCE) dCE.textContent = domainCE;
    const dGT = document.getElementById('countDomainGT');
    if (dGT) dGT.textContent = domainGT;
}

// Helper to Map String Title categories
function normalizeCategory(type) {
    const t = type.toLowerCase();
    if (t.includes('feature') || t.includes('new')) return 'feature';
    if (t.includes('issue') || t.includes('fix') || t.includes('broken') || t.includes('bug') || t.includes('resolved') || t.includes('fixed')) return 'issue';
    if (t.includes('announcement') || t.includes('notice') || t.includes('general')) return 'announcement';
    return 'other';
}

// Apply Search & Tag filters to current state
function applyFilters() {
    renderFeed();
}

// Select All currently filtered, visible cards
function selectAllVisible() {
    const visibleCards = elements.feedContainer.querySelectorAll('.update-card');
    if (visibleCards.length === 0) return;
    
    let allSelected = true;
    visibleCards.forEach(card => {
        if (!selectedUpdates.has(card.dataset.id)) {
            allSelected = false;
        }
    });
    
    visibleCards.forEach(card => {
        const id = card.dataset.id;
        if (allSelected) {
            selectedUpdates.delete(id);
            card.classList.remove('selected');
        } else {
            selectedUpdates.add(id);
            card.classList.add('selected');
        }
    });
    
    onSelectionChange();
}

// Clear all selected cards in workspace
function clearAllSelections() {
    selectedUpdates.clear();
    elements.feedContainer.querySelectorAll('.update-card').forEach(card => {
        card.classList.remove('selected');
    });
    onSelectionChange();
}

// Render dynamic Feed
function renderFeed() {
    elements.feedContainer.innerHTML = '';
    let renderedCount = 0;
    
    releaseData.forEach(entry => {
        // Filter the updates in this entry
        const filteredUpdates = entry.updates.filter(update => {
            // Category Filter match
            const categoryMatch = currentCategory === 'all' || normalizeCategory(update.type) === currentCategory;
            
            // Domain Filter match
            const updateDomains = update.domains || [];
            const domainMatch = currentDomain === 'all' || 
                updateDomains.includes(currentDomain) ||
                (currentDomain === 'General Technical' && updateDomains.length === 0);
            
            // Search Query text match
            const searchMatch = !searchQuery || 
                update.type.toLowerCase().includes(searchQuery) || 
                update.text.toLowerCase().includes(searchQuery) ||
                entry.date.toLowerCase().includes(searchQuery);
                
            return categoryMatch && domainMatch && searchMatch;
        });
        
        if (filteredUpdates.length === 0) return; // Skip days with no matches
        
        // Create Date Group Element
        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group';
        
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.textContent = entry.date;
        dateGroup.appendChild(dateHeader);
        
        const cardsList = document.createElement('div');
        cardsList.className = 'update-cards-list';
        
        filteredUpdates.forEach(update => {
            renderedCount++;
            
            const isSelected = selectedUpdates.has(update.id);
            const card = document.createElement('div');
            card.className = `update-card ${isSelected ? 'selected' : ''}`;
            card.dataset.id = update.id;
            card.dataset.text = update.text;
            card.dataset.type = update.type;
            card.dataset.date = entry.date;
            card.dataset.link = entry.link;
            
            // Generate custom badges class
            const normCat = normalizeCategory(update.type);
            const badgeClass = `badge-${normCat}`;
            
            // Generate domain badges and explanation
            const domainsList = update.domains || ["General Technical"];
            const domainBadgesHtml = domainsList.map(dom => {
                let badgeClass = 'dom-gt';
                if (dom === 'Data Engineer') badgeClass = 'dom-de';
                else if (dom === 'Data Analyst') badgeClass = 'dom-da';
                else if (dom === 'Software Engineer') badgeClass = 'dom-se';
                else if (dom === 'Cloud Engineer') badgeClass = 'dom-ce';
                return `<span class="domain-badge ${badgeClass}">${dom}</span>`;
            }).join('');
            
            const explanationHtml = update.domain_explanation ? 
                `<p class="domain-explanation-text">${update.domain_explanation}</p>` : 
                `<p class="domain-explanation-text">General platform update.</p>`;
            
            card.innerHTML = `
                <div class="card-checkbox-area">
                    <div class="custom-checkbox">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                </div>
                <div class="card-details">
                    <div class="card-top">
                        <span class="type-badge ${badgeClass}">${update.type}</span>
                    </div>
                    <div class="card-body">
                        ${update.html}
                    </div>
                    <div class="card-actions">
                        <button class="card-action-btn copy-action-btn" title="Copy update text">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Copy</span>
                        </button>
                        <button class="card-action-btn tweet-action-btn" title="Compose a Tweet with this update">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                            <span>Tweet</span>
                        </button>
                    </div>
                </div>
                <div class="card-domain-info">
                    <div class="domain-badges-container">
                        ${domainBadgesHtml}
                    </div>
                    <div class="domain-explanation-container">
                        <span class="explanation-title">Why it matters:</span>
                        ${explanationHtml}
                    </div>
                </div>
            `;
            
            // Card selection click handler (excluding action button clicks)
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-action-btn')) return;
                toggleCardSelection(card);
            });
            
            // Action buttons handlers
            card.querySelector('.copy-action-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(update.text, 'Update text copied!');
            });
            
            card.querySelector('.tweet-action-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                // Select only this card and open compose
                selectedUpdates.clear();
                elements.feedContainer.querySelectorAll('.update-card').forEach(c => c.classList.remove('selected'));
                
                selectedUpdates.add(update.id);
                card.classList.add('selected');
                onSelectionChange();
                openDrawer();
            });
            
            cardsList.appendChild(card);
        });
        
        dateGroup.appendChild(cardsList);
        elements.feedContainer.appendChild(dateGroup);
    });
    
    if (renderedCount === 0) {
        elements.feedContainer.style.display = 'none';
        elements.emptyState.style.display = 'flex';
    } else {
        elements.emptyState.style.display = 'none';
        elements.feedContainer.style.display = 'block';
    }
}

// Card Selection Toggle
function toggleCardSelection(card) {
    const id = card.dataset.id;
    if (selectedUpdates.has(id)) {
        selectedUpdates.delete(id);
        card.classList.remove('selected');
    } else {
        selectedUpdates.add(id);
        card.classList.add('selected');
    }
    onSelectionChange();
}

// Handle selection state modification
function onSelectionChange() {
    const count = selectedUpdates.size;
    elements.selectedCountBadge.textContent = `${count} selected`;
    
    // Update sidebar Selection Mode panel
    if (count > 0) {
        elements.clearSelectionBtn.disabled = false;
        elements.clearSelectionBtn.textContent = `Clear Selection (${count})`;
        openDrawer();
    } else {
        elements.clearSelectionBtn.disabled = true;
        elements.clearSelectionBtn.textContent = 'Clear Selection';
        closeDrawer();
    }
    
    generateTweetDraft();
}

// Open / Close Drawer
function openDrawer() {
    elements.tweetDrawer.classList.add('open');
}

function closeDrawer() {
    elements.tweetDrawer.classList.remove('open');
}

// Helper to copy text to clipboard
function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy text.');
    });
}

// Auto-compile selected updates into Tweet text
function generateTweetDraft() {
    if (selectedUpdates.size === 0) {
        elements.tweetTextarea.value = '';
        updateCharCount();
        return;
    }
    
    // Extract data for selected cards in order of visual display
    const selectedCards = [];
    elements.feedContainer.querySelectorAll('.update-card.selected').forEach(card => {
        selectedCards.push({
            id: card.dataset.id,
            type: card.dataset.type,
            text: card.dataset.text,
            date: card.dataset.date,
            link: card.dataset.link
        });
    });
    
    let draftText = '';
    
    if (tweetStyle === 'digest') {
        draftText = `BigQuery Updates Feed Summary: \n\n`;
        selectedCards.forEach(card => {
            const emoji = getCategoryEmoji(card.type);
            draftText += `${emoji} [${card.type}] ${truncateText(card.text, 80)}\n`;
        });
        
        // Append release notes link (referencing the latest update's date hash if one card, otherwise general)
        const link = selectedCards.length === 1 ? selectedCards[0].link : 'https://cloud.google.com/bigquery/docs/release-notes';
        draftText += `\nRead details: ${link}`;
        
    } else if (tweetStyle === 'bullet') {
        draftText = `New @GoogleCloud BigQuery updates:\n`;
        selectedCards.forEach(card => {
            const headline = truncateText(card.text, 60);
            draftText += `• ${headline} (${card.type})\n`;
        });
        const link = selectedCards.length === 1 ? selectedCards[0].link : 'https://cloud.google.com/bigquery/docs/release-notes';
        draftText += `\nLink: ${link}`;
        
    } else if (tweetStyle === 'simple') {
        if (selectedCards.length > 0) {
            const mainCard = selectedCards[0];
            const headline = truncateText(mainCard.text, 140);
            draftText = `BigQuery ${mainCard.type} (${mainCard.date}): ${headline}\n\nRead more: ${mainCard.link}`;
            
            if (selectedCards.length > 1) {
                draftText = `BigQuery Updates Digest (${mainCard.date}): ${headline} + ${selectedCards.length - 1} other updates.\n\nDetails: ${mainCard.link}`;
            }
        }
    }
    
    elements.tweetTextarea.value = draftText;
    updateCharCount();
}

// Get appropriate emoji based on update type
function getCategoryEmoji(type) {
    const cat = normalizeCategory(type);
    if (cat === 'feature') return '🚀';
    if (cat === 'issue') return '⚠️';
    if (cat === 'announcement') return '📢';
    return '⚡';
}

// Truncate helper
function truncateText(str, num) {
    if (str.length <= num) {
        return str;
    }
    return str.slice(0, num) + '...';
}

// Manage textarea character length validation
function updateCharCount() {
    const len = elements.tweetTextarea.value.length;
    elements.charCount.textContent = len;
    
    const wrapper = elements.charCount.parentElement;
    
    if (len > 280) {
        wrapper.className = 'character-count-wrapper danger';
        elements.charWarning.style.display = 'inline';
    } else if (len > 240) {
        wrapper.className = 'character-count-wrapper warning';
        elements.charWarning.style.display = 'none';
    } else {
        wrapper.className = 'character-count-wrapper';
        elements.charWarning.style.display = 'none';
    }
}

// Copy drafted tweet
function copyTweetToClipboard() {
    const text = elements.tweetTextarea.value;
    if (!text) {
        showToast('Nothing to copy!');
        return;
    }
    copyToClipboard(text, 'Tweet text copied!');
}

// Open X Intent
function triggerTweetIntent() {
    const text = elements.tweetTextarea.value;
    if (!text) {
        showToast('Select an update to draft a tweet!');
        return;
    }
    
    // Twitter Intent URL
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}
