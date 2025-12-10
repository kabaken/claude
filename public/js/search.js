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

    // Hide project groups that have no visible chats
    function updateProjectVisibility() {
        const projectGroups = document.querySelectorAll('.project-group');
        projectGroups.forEach(group => {
            const visibleCards = group.querySelectorAll('.chat-card[style*="display: block"], .chat-card:not([style*="display: none"])');
            const hasVisible = Array.from(group.querySelectorAll('.chat-card')).some(card => card.style.display !== 'none');
            group.style.display = hasVisible ? 'block' : 'none';
        });
    }
});