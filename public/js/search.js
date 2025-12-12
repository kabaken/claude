// Live find functionality for homepage
document.addEventListener('DOMContentLoaded', function() {
    const findLink = document.querySelector('.find-link');
    const findInputContainer = document.querySelector('.find-input-container');
    const findInput = document.querySelector('.find-input');
    const findResultsCount = document.querySelector('.find-results-count');
    const chatList = document.querySelector('.chat-list');
    const chatCards = document.querySelectorAll('.chat-card');
    const messageFilter = document.getElementById('message-filter');

    let isInFindMode = false;
    let originalOrder = [];
    let currentSearchTerm = '';
    let currentMinMessages = 0;

    // Cookie helper functions
    function setCookie(name, value, days = 365) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${name}=${value}; expires=${expires}; path=/`;
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    // Restore filter from cookie
    const savedFilter = getCookie('messageFilter');
    if (savedFilter && messageFilter) {
        messageFilter.value = savedFilter;
        currentMinMessages = parseInt(savedFilter, 10);
        applyFilters();
    }

    // Restore scroll position and collapsed state
    const savedScrollPosition = sessionStorage.getItem('homeScrollPosition');
    const savedCollapsedState = sessionStorage.getItem('collapsedProjects');

    if (savedCollapsedState) {
        try {
            const collapsedProjects = JSON.parse(savedCollapsedState);
            document.querySelectorAll('.project-group').forEach(group => {
                const projectName = group.querySelector('.project-name-text')?.textContent;
                if (projectName && !collapsedProjects.includes(projectName)) {
                    group.classList.remove('collapsed');
                }
            });
        } catch (e) {
            console.error('Failed to restore collapsed state:', e);
        }
    }

    if (savedScrollPosition) {
        setTimeout(() => {
            window.scrollTo(0, parseInt(savedScrollPosition, 10));
            sessionStorage.removeItem('homeScrollPosition');
        }, 100);
    }

    // Store original order
    chatCards.forEach((card, index) => {
        originalOrder.push({
            card: card,
            originalIndex: index
        });
    });
    
    if (findLink) {
        findLink.addEventListener('click', function(e) {
            e.preventDefault();
            toggleFindMode();
        });
    }
    
    if (findInput) {
        let searchTimeout;
        findInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performFind(this.value.trim());
            }, 200); // 200ms debounce
        });
        
        findInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                exitFindMode();
            }
        });
    }

    // Message count filter
    if (messageFilter) {
        messageFilter.addEventListener('change', function() {
            currentMinMessages = parseInt(this.value, 10);
            setCookie('messageFilter', this.value);
            applyFilters();
        });
    }
    
    function toggleFindMode() {
        if (isInFindMode) {
            exitFindMode();
        } else {
            enterFindMode();
        }
    }
    
    function enterFindMode() {
        isInFindMode = true;
        findLink.textContent = '✕ Exit Find';
        findLink.title = 'Exit find mode';
        findInputContainer.style.display = 'block';
        findInput.focus();
    }
    
    function exitFindMode() {
        isInFindMode = false;
        findLink.textContent = '🔍 Find';
        findLink.title = 'Find in conversations';
        findInputContainer.style.display = 'none';
        findInput.value = '';
        findResultsCount.textContent = '';
        currentSearchTerm = '';

        // Show chat cards based on message filter
        chatCards.forEach(card => {
            const messageCount = parseInt(card.dataset.messageCount, 10) || 0;
            if (messageCount > currentMinMessages) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
            card.querySelector('.match-count-line').style.display = 'none';
            // Reset download links to original URLs
            const downloadLink = card.querySelector('.download-link');
            if (downloadLink) {
                const chatId = downloadLink.href.split('/download/')[1].split('?')[0];
                downloadLink.href = `/download/${chatId}`;
            }
        });

        // Restore original order
        restoreOriginalOrder();
        updateProjectVisibility();
    }
    
    // Add click handler for chat links to pass search term
    document.addEventListener('click', function(e) {
        const chatLink = e.target.closest('.chat-link');
        if (chatLink && isInFindMode && currentSearchTerm) {
            e.preventDefault();
            const href = chatLink.getAttribute('href');
            const searchUrl = `${href}?search=${encodeURIComponent(currentSearchTerm)}`;
            window.location.href = searchUrl;
        }
    });
    
    function performFind(searchTerm) {
        currentSearchTerm = searchTerm;
        
        if (!searchTerm) {
            // No search term - apply message filter only
            chatCards.forEach(card => {
                const messageCount = parseInt(card.dataset.messageCount, 10) || 0;
                if (messageCount > currentMinMessages) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
                card.querySelector('.match-count-line').style.display = 'none';
                // Reset download links to original URLs
                const downloadLink = card.querySelector('.download-link');
                if (downloadLink) {
                    const chatId = downloadLink.href.split('/download/')[1].split('?')[0];
                    downloadLink.href = `/download/${chatId}`;
                }
            });
            findResultsCount.textContent = '';
            restoreOriginalOrder();
            updateProjectVisibility();
            return;
        }
        
        const searchLower = searchTerm.toLowerCase();
        const results = [];
        let totalMatches = 0;
        let visibleChats = 0;
        
        chatCards.forEach(card => {
            // Use the full searchable text that includes all messages
            const searchableText = (card.dataset.searchable || '').toLowerCase();
            const messageCount = parseInt(card.dataset.messageCount, 10) || 0;

            // Check message filter first
            if (messageCount <= currentMinMessages) {
                card.style.display = 'none';
                card.querySelector('.match-count-line').style.display = 'none';
                return;
            }

            // Count matches
            const matches = countMatches(searchableText, searchLower);

            if (matches > 0) {
                results.push({
                    card: card,
                    matches: matches
                });
                totalMatches += matches;
                visibleChats++;
                
                // Show match count
                const matchCountLine = card.querySelector('.match-count-line');
                const matchCount = card.querySelector('.match-count');
                matchCount.textContent = `🔍 ${matches} match${matches > 1 ? 'es' : ''} found`;
                matchCountLine.style.display = 'block';
                card.style.display = 'block';
                
                // Update download link to include search term
                const downloadLink = card.querySelector('.download-link');
                if (downloadLink) {
                    const chatId = downloadLink.href.split('/download/')[1].split('?')[0];
                    downloadLink.href = `/download/${chatId}?search=${encodeURIComponent(searchTerm)}`;
                }
            } else {
                // Hide non-matching chats
                card.style.display = 'none';
                card.querySelector('.match-count-line').style.display = 'none';
            }
        });
        
        // Update results count
        if (visibleChats > 0) {
            findResultsCount.textContent = `${totalMatches} match${totalMatches > 1 ? 'es' : ''} in ${visibleChats} conversation${visibleChats > 1 ? 's' : ''}`;
        } else {
            findResultsCount.textContent = 'No matches found';
        }
        
        // Sort by match count (most matches first)
        sortByMatches(results);
        updateProjectVisibility();
    }
    
    function countMatches(text, searchTerm) {
        if (!searchTerm) return 0;
        const regex = new RegExp(escapeRegex(searchTerm), 'gi');
        const matches = text.match(regex);
        return matches ? matches.length : 0;
    }
    
    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&');
    }
    
    function sortByMatches(results) {
        // Sort by match count (descending)
        results.sort((a, b) => b.matches - a.matches);
        
        // Re-append cards in new order
        results.forEach(result => {
            chatList.appendChild(result.card);
        });
    }
    
    function restoreOriginalOrder() {
        // Sort by original index
        originalOrder.sort((a, b) => a.originalIndex - b.originalIndex);

        // Re-append in original order
        originalOrder.forEach(item => {
            chatList.appendChild(item.card);
        });
    }

    // Apply both search and message filter
    function applyFilters() {
        if (isInFindMode && currentSearchTerm) {
            performFind(currentSearchTerm);
        } else {
            // Only message filter active
            let visibleCount = 0;
            chatCards.forEach(card => {
                const messageCount = parseInt(card.dataset.messageCount, 10) || 0;
                if (messageCount > currentMinMessages) {
                    card.style.display = 'block';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
                card.querySelector('.match-count-line').style.display = 'none';
            });
            updateProjectVisibility();
        }
    }

    // Hide project groups that have no visible chats and update counts
    function updateProjectVisibility() {
        const projectGroups = document.querySelectorAll('.project-group');
        projectGroups.forEach(group => {
            const allCards = group.querySelectorAll('.chat-card');
            const visibleCards = Array.from(allCards).filter(card => card.style.display !== 'none');
            const visibleCount = visibleCards.length;

            // Update project count badge
            const countBadge = group.querySelector('.project-count');
            if (countBadge) {
                countBadge.textContent = visibleCount;
            }

            // Hide group if no visible chats
            group.style.display = visibleCount > 0 ? 'block' : 'none';
        });
    }
});