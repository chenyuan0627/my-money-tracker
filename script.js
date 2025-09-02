// 初始化記錄陣列
let records = JSON.parse(localStorage.getItem('records')) || [];
let cardRecords = JSON.parse(localStorage.getItem('cardRecords')) || [];
let cardLimit = parseFloat(localStorage.getItem('cardLimit')) || 19872;
let balanceRecords = JSON.parse(localStorage.getItem('balanceRecords')) || [];
let limitHistory = JSON.parse(localStorage.getItem('limitHistory')) || [];

// 分頁相關變數
let currentPage = 1;
let currentCardPage = 1; // 刷卡記錄專用的分頁變數
const itemsPerPage = 10;

// 帳戶限額設定
const accountLimits = {
    post: 1200000,    // 郵局帳戶上限
    bank: 50000,      // 簽帳卡上限
    alipay: 2000      // 支付寶上限
};

// 當頁面載入時
document.addEventListener('DOMContentLoaded', function() {
    // 設定今天的日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    document.getElementById('cardDate').value = today;
    document.getElementById('balanceDate').value = today;
    
    // 確保 cardLimit 是數字
    if (typeof cardLimit === 'string') {
        try {
            const parsedLimit = JSON.parse(cardLimit);
            cardLimit = parsedLimit.total || 19872;
        } catch (e) {
            cardLimit = 19872;
        }
    }
    
    // 儲存正確的 cardLimit 格式
    localStorage.setItem('cardLimit', cardLimit.toString());
    
    // 初始化月份選擇器
    initMonthSelector();
    
    // 載入記錄
    updateRecordsList();
    updateStats();
    initCharts();
    updateCardRecordsList();
    updateCardUsage();
    updateBalanceDisplay();
    initBalanceChart();
    checkAndUpdateMonthlyLimit();
    updateLimitHistory();
    
    // 設定總限額輸入框的初始值
    document.getElementById('totalLimit').value = cardLimit;
    
    // 更新總限額顯示
    updateTotalLimit();
    updateBalanceTrendChart();  // 添加這行來初始化餘額趨勢圖表
});

// 初始化月份選擇器
function initMonthSelector() {
    const monthSelector = document.getElementById('monthSelector');
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // 獲取所有記錄的日期，計算可用的月份
    const availableMonths = new Set();
    
    // 添加當前月份
    availableMonths.add(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);
    
    // 從記錄中提取月份
    records.forEach(record => {
        const date = new Date(record.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        availableMonths.add(monthKey);
    });
    
    // 轉換為陣列並排序（從新到舊）
    const sortedMonths = Array.from(availableMonths).sort((a, b) => b.localeCompare(a));
    
    // 清空選擇器
    monthSelector.innerHTML = '';
    
    // 添加選項
    sortedMonths.forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = `${year}年${parseInt(month)}月`;
        monthSelector.appendChild(option);
    });
    
    // 設定當前月份為預設選項
    const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    monthSelector.value = currentMonthKey;
    
    // 添加變更事件監聽器
    monthSelector.addEventListener('change', function() {
        updateTrendChart();
    });
}

// 初始化圖表
function initCharts() {
    // 支出分類圖
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    window.categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: ['薪資', '飲食', '交通', '購物', '娛樂', '儲蓄', '繳費', '手續費', '其他'],
            datasets: [{
                data: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                backgroundColor: [
                    '#FFB3BA',  // 粉紅馬卡龍
                    '#BAFFC9',  // 薄荷馬卡龍
                    '#BAE1FF',  // 天藍馬卡龍
                    '#FFFFBA',  // 檸檬馬卡龍
                    '#FF6B9D',  // 娛樂粉紅
                    '#FFE4BA',  // 杏桃馬卡龍
                    '#E8BAFF',  // 薰衣草馬卡龍
                    '#FFD4BA',  // 珊瑚馬卡龍
                    '#BAFFE4'   // 薄荷綠馬卡龍
                ],
                borderWidth: 4,
                borderColor: '#ffffff',
                hoverOffset: 20,
                hoverBorderWidth: 5,
                hoverBorderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '35%',
            rotation: -90,
            circumference: 360,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 25,
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: "'Microsoft JhengHei', sans-serif"
                        },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        color: '#2c3e50'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 16,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 14
                    },
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value.toLocaleString()} 元 (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });

    // 收支趨勢圖
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    window.trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '收入',
                    borderColor: '#4a9d8f',
                    backgroundColor: 'rgba(74, 157, 143, 0.1)',
                    data: []
                },
                {
                    label: '支出',
                    borderColor: '#e67e5d',
                    backgroundColor: 'rgba(230, 126, 93, 0.1)',
                    data: []
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 15
                    }
                }
            }
        }
    });

    // 刷卡分類堆疊條形圖
    const cardCategoryStackedCtx = document.getElementById('cardCategoryStackedChart').getContext('2d');
    window.cardCategoryStackedChart = new Chart(cardCategoryStackedCtx, {
        type: 'bar',
        data: {
            labels: ['金額比例', '次數比例'],
            datasets: [
                {
                    label: '飲食',
                    data: [0, 0],
                    backgroundColor: '#FF6384',
                    borderWidth: 0
                },
                {
                    label: '交通',
                    data: [0, 0],
                    backgroundColor: '#36A2EB',
                    borderWidth: 0
                },
                {
                    label: '購物',
                    data: [0, 0],
                    backgroundColor: '#FFCE56',
                    borderWidth: 0
                },
                {
                    label: '娛樂',
                    data: [0, 0],
                    backgroundColor: '#FF6B9D',
                    borderWidth: 0
                },
                {
                    label: '繳費',
                    data: [0, 0],
                    backgroundColor: '#9966FF',
                    borderWidth: 0
                },
                {
                    label: '手續費',
                    data: [0, 0],
                    backgroundColor: '#FF9F40',
                    borderWidth: 0
                },
                {
                    label: '其他',
                    data: [0, 0],
                    backgroundColor: '#C9CBCF',
                    borderWidth: 0
                }
            ]
        },
        options: {
            indexAxis: 'y', // 橫向條形圖
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    beginAtZero: true,
                    max: 100, // 百分比最大值為100%
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    title: {
                        display: true,
                        text: '百分比 (%)'
                    }
                },
                y: {
                    stacked: true,
                    ticks: {
                        font: {
                            size: 12,
                            weight: 'bold',
                            family: "'Microsoft JhengHei', sans-serif"
                        },
                        color: '#2c3e50'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: 'bold',
                            family: "'Microsoft JhengHei', sans-serif"
                        },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        color: '#2c3e50'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 12
                    },
                    callbacks: {
                        title: function(context) {
                            const dataIndex = context[0].dataIndex;
                            return dataIndex === 0 ? '金額比例' : '次數比例';
                        },
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.raw || 0;
                            const dataIndex = context.dataIndex;
                            const unit = dataIndex === 0 ? '金額' : '次數';
                            return `${label} ${unit}: ${value.toFixed(1)}%`;
                        }
                    }
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            }
        }
    });

    updateCharts();
}

// 更新圖表
function updateCharts() {
    // 更新收支趨勢圖
    updateTrendChart();
    // 更新支出分類圖
    updateExpenseChart();
    // 更新刷卡分類堆疊條形圖
    updateCardCategoryStackedChart();
}

// 更新趨勢圖表
function updateTrendChart() {
    const monthSelector = document.getElementById('monthSelector');
    const selectedMonth = monthSelector ? monthSelector.value : null;
    
    let trendData;
    if (selectedMonth) {
        // 根據選擇的月份獲取數據
        trendData = getMonthlyTrendData(selectedMonth);
    } else {
        // 預設顯示最近30天
        const dates = getLast30Days();
        trendData = getTrendData(dates);
    }
    
    window.trendChart.data.labels = trendData.labels;
    window.trendChart.data.datasets[0].data = trendData.income;
    window.trendChart.data.datasets[1].data = trendData.expense;
    window.trendChart.update();
}

// 獲取指定月份的趨勢數據
function getMonthlyTrendData(monthKey) {
    const [year, month] = monthKey.split('-');
    const targetYear = parseInt(year);
    const targetMonth = parseInt(month) - 1; // JavaScript 月份從0開始
    
    // 獲取該月份的所有日期
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const dates = [];
    const labels = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(targetYear, targetMonth, day);
        const dateString = date.toISOString().split('T')[0];
        dates.push(dateString);
        labels.push(`${targetMonth + 1}/${day}`);
    }
    
    // 初始化收入和支出陣列
    const income = new Array(dates.length).fill(0);
    const expense = new Array(dates.length).fill(0);
    
    // 計算每日的收入和支出
    records.forEach(record => {
        const recordDate = new Date(record.date);
        if (recordDate.getFullYear() === targetYear && recordDate.getMonth() === targetMonth) {
            const dayIndex = recordDate.getDate() - 1;
            if (dayIndex >= 0 && dayIndex < dates.length) {
                if (record.type === 'income') {
                    income[dayIndex] += record.amount;
                } else {
                    expense[dayIndex] += record.amount;
                }
            }
        }
    });
    
    return { labels, income, expense };
}

// 獲取最近30天的日期
function getLast30Days() {
    const dates = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
}

// 獲取趨勢數據
function getTrendData(dates) {
    const income = new Array(dates.length).fill(0);
    const expense = new Array(dates.length).fill(0);
    const labels = dates.map(date => {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    });

    records.forEach(record => {
        const index = dates.indexOf(record.date);
        if (index !== -1) {
            if (record.type === 'income') {
                income[index] += record.amount;
            } else {
                expense[index] += record.amount;
            }
        }
    });

    return { labels, income, expense };
}

// 獲取分類數據
function getCategoryData() {
    const categories = {
        'salary': 0,
        'food': 0,
        'transport': 0,
        'shopping': 0,
        'entertainment': 0,
        'savings': 0,
        'payment': 0,
        'fee': 0,
        'other': 0
    };

    records.forEach(record => {
        if (record.type === 'expense') {
            categories[record.category] += record.amount;
        }
    });

    return Object.values(categories);
}

// 表單提交處理
document.getElementById('expenseForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // 獲取表單數據
    const date = document.getElementById('date').value;
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value;
    
    // 檢查是否為編輯模式
    const editId = this.getAttribute('data-edit-id');
    
    if (editId) {
        // 編輯模式：更新現有記錄
        const recordIndex = records.findIndex(record => record.id === parseInt(editId));
        if (recordIndex !== -1) {
            records[recordIndex] = {
                id: parseInt(editId),
                date: date,
                type: type,
                category: category,
                amount: amount,
                description: description
            };
            
            // 取消編輯模式
            cancelEdit();
            
            alert('記錄已成功更新！');
        } else {
            alert('找不到要更新的記錄！');
            return;
        }
    } else {
        // 新增模式：創建新記錄
        const newRecord = {
            id: Date.now(),
            date: date,
            type: type,
            category: category,
            amount: amount,
            description: description
        };
        
        // 添加到記錄陣列
        records.push(newRecord);
        
        // 重置表單
        this.reset();
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
    }
    
    // 保存到 localStorage
    localStorage.setItem('records', JSON.stringify(records));
    
    // 更新顯示
    updateRecordsList();
    updateStats();
    initMonthSelector(); // 重新初始化月份選擇器以包含新的月份
    updateCharts();
});

// 更新記錄列表
function updateRecordsList() {
    const recordsList = document.getElementById('recordsList');
    recordsList.innerHTML = '';
    
    // 按日期排序（從新到舊）
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 計算總頁數
    const totalPages = Math.ceil(records.length / itemsPerPage);
    
    // 獲取當前頁的記錄
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageRecords = records.slice(startIndex, endIndex);
    
    // 顯示當前頁的記錄
    currentPageRecords.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.date}</td>
            <td>${record.type === 'income' ? '收入 💰' : '支出 💸'}</td>
            <td>${getCategoryName(record.category)}</td>
            <td>${record.amount.toLocaleString()}</td>
            <td>${record.description}</td>
            <td>
                <button class="edit-btn" onclick="editRecord(${record.id})">
                    <i class="fas fa-edit"></i> 編輯
                </button>
                <button class="delete-btn" onclick="deleteRecord(${record.id})">
                    <i class="fas fa-trash"></i> 刪除
                </button>
            </td>
        `;
        recordsList.appendChild(row);
    });
    
    // 更新分頁控制
    updatePagination(totalPages);
}

// 更新分頁控制
function updatePagination(totalPages) {
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
    
    if (totalPages <= 1) {
        return; // 如果只有一頁或沒有資料，不顯示分頁控制
    }
    
    const maxPagesDisplay = 10; // 一次最多顯示10個頁面按鈕
    
    // 計算當前頁面組的範圍
    const currentGroup = Math.ceil(currentPage / maxPagesDisplay);
    const startPage = (currentGroup - 1) * maxPagesDisplay + 1;
    const endPage = Math.min(startPage + maxPagesDisplay - 1, totalPages);
    
    // 上一頁按鈕
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i> 上一頁';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            updateRecordsList();
        }
    };
    paginationContainer.appendChild(prevButton);
    
    // 上一組按鈕（如果不是第一組）
    if (startPage > 1) {
        const prevGroupButton = document.createElement('button');
        prevGroupButton.innerHTML = '<i class="fas fa-angle-double-left"></i>';
        prevGroupButton.title = '上一組頁面';
        prevGroupButton.onclick = () => {
            currentPage = startPage - 1;
            updateRecordsList();
        };
        paginationContainer.appendChild(prevGroupButton);
        
        // 顯示第一頁
        const firstPageButton = document.createElement('button');
        firstPageButton.innerHTML = '1';
        firstPageButton.onclick = () => {
            currentPage = 1;
            updateRecordsList();
        };
        paginationContainer.appendChild(firstPageButton);
        
        // 省略號
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.innerHTML = '...';
            ellipsis.className = 'pagination-ellipsis';
            paginationContainer.appendChild(ellipsis);
        }
    }
    
    // 頁碼按鈕（當前組的頁面）
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.innerHTML = i;
        pageButton.className = currentPage === i ? 'active' : '';
        pageButton.onclick = () => {
            currentPage = i;
            updateRecordsList();
        };
        paginationContainer.appendChild(pageButton);
    }
    
    // 下一組按鈕（如果不是最後一組）
    if (endPage < totalPages) {
        // 省略號
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.innerHTML = '...';
            ellipsis.className = 'pagination-ellipsis';
            paginationContainer.appendChild(ellipsis);
        }
        
        // 顯示最後一頁
        const lastPageButton = document.createElement('button');
        lastPageButton.innerHTML = totalPages;
        lastPageButton.onclick = () => {
            currentPage = totalPages;
            updateRecordsList();
        };
        paginationContainer.appendChild(lastPageButton);
        
        const nextGroupButton = document.createElement('button');
        nextGroupButton.innerHTML = '<i class="fas fa-angle-double-right"></i>';
        nextGroupButton.title = '下一組頁面';
        nextGroupButton.onclick = () => {
            currentPage = endPage + 1;
            updateRecordsList();
        };
        paginationContainer.appendChild(nextGroupButton);
    }
    
    // 下一頁按鈕
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '下一頁 <i class="fas fa-chevron-right"></i>';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            updateRecordsList();
        }
    };
    paginationContainer.appendChild(nextButton);
    
    // 添加分頁信息
    const paginationInfo = document.createElement('span');
    paginationInfo.className = 'pagination-info';
    paginationInfo.innerHTML = `第 ${currentPage} 頁，共 ${totalPages} 頁 (第 ${currentGroup} 組)`;
    paginationContainer.appendChild(paginationInfo);
}

// 更新統計數據
function updateStats() {
    const totalIncome = records
        .filter(record => record.type === 'income')
        .reduce((sum, record) => sum + record.amount, 0);
    
    const totalExpense = records
        .filter(record => record.type === 'expense')
        .reduce((sum, record) => sum + record.amount, 0);
    
    const balance = totalIncome - totalExpense;
    
    document.getElementById('totalIncome').textContent = totalIncome.toLocaleString();
    document.getElementById('totalExpense').textContent = totalExpense.toLocaleString();
    document.getElementById('balance').textContent = balance.toLocaleString();
}

// 編輯記錄
function editRecord(id) {
    const record = records.find(record => record.id === id);
    if (!record) {
        alert('找不到要編輯的記錄！');
        return;
    }
    
    // 填入表單數據
    document.getElementById('date').value = record.date;
    document.getElementById('type').value = record.type;
    document.getElementById('category').value = record.category;
    document.getElementById('amount').value = record.amount;
    document.getElementById('description').value = record.description;
    
    // 將表單滾動到視窗頂部
    document.querySelector('.form-container').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
    
    // 改變表單按鈕為更新模式
    const form = document.getElementById('expenseForm');
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    const originalButtonColor = submitButton.style.backgroundColor;
    
    // 修改按鈕樣式和文字
    submitButton.innerHTML = '<i class="fas fa-save"></i> 更新記錄';
    submitButton.style.backgroundColor = '#17a2b8';
    
    // 添加數據屬性來標記編輯模式
    form.setAttribute('data-edit-id', id);
    form.setAttribute('data-original-button-text', originalButtonText);
    form.setAttribute('data-original-button-color', originalButtonColor);
    
    // 添加取消按鈕
    if (!form.querySelector('.cancel-edit-btn')) {
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'cancel-edit-btn';
        cancelButton.innerHTML = '<i class="fas fa-times"></i> 取消編輯';
        cancelButton.style.backgroundColor = '#6c757d';
        cancelButton.style.marginLeft = '10px';
        cancelButton.onclick = cancelEdit;
        submitButton.parentNode.insertBefore(cancelButton, submitButton.nextSibling);
    }
}

// 取消編輯
function cancelEdit() {
    const form = document.getElementById('expenseForm');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelButton = form.querySelector('.cancel-edit-btn');
    
    // 恢復按鈕原始狀態
    const originalButtonText = form.getAttribute('data-original-button-text');
    const originalButtonColor = form.getAttribute('data-original-button-color');
    
    submitButton.innerHTML = originalButtonText;
    submitButton.style.backgroundColor = originalButtonColor;
    
    // 移除編輯模式標記
    form.removeAttribute('data-edit-id');
    form.removeAttribute('data-original-button-text');
    form.removeAttribute('data-original-button-color');
    
    // 移除取消按鈕
    if (cancelButton) {
        cancelButton.remove();
    }
    
    // 重置表單
    form.reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

// 刪除記錄
function deleteRecord(id) {
    if (confirm('確定要刪除這筆記錄嗎？')) {
        records = records.filter(record => record.id !== id);
        localStorage.setItem('records', JSON.stringify(records));
        updateRecordsList();
        updateStats();
        initMonthSelector(); // 重新初始化月份選擇器
        updateCharts();
    }
}

// 獲取刷卡週期月份（每月5號到下個月4號）
function getBillingCycleMonth(date) {
    const targetDate = new Date(date);
    const day = targetDate.getDate();
    
    // 如果日期是1-4號，屬於上個月的週期
    if (day >= 1 && day <= 4) {
        targetDate.setMonth(targetDate.getMonth() - 1);
    }
    
    return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
}

// 獲取當前刷卡週期月份
function getCurrentBillingCycleMonth() {
    return getBillingCycleMonth(new Date());
}

// 獲取類別名稱
function getCategoryName(category) {
    const categories = {
        'salary': '薪資 💼',
        'food': '飲食 🍱',
        'transport': '交通 🚗',
        'shopping': '購物 🛍️',
        'entertainment': '娛樂 🎮',
        'savings': '儲蓄 💰',
        'payment': '繳費 💳',
        'fee': '手續費 💳',
        'other': '其他 ✨'
    };
    return categories[category] || category;
}

// 更新刷卡使用情況
function updateCardUsage() {
    const currentBillingCycle = getCurrentBillingCycleMonth();
    const usedAmount = cardRecords.reduce((sum, record) => {
        const recordBillingCycle = getBillingCycleMonth(record.date);
        if (recordBillingCycle === currentBillingCycle) {
            return sum + parseFloat(record.amount);
        }
        return sum;
    }, 0);
    
    const remainingAmount = cardLimit - usedAmount;
    
    document.getElementById('totalLimit').textContent = cardLimit.toLocaleString();
    document.getElementById('usedAmount').textContent = usedAmount.toLocaleString();
    document.getElementById('remainingAmount').textContent = remainingAmount.toLocaleString();
}

// 更新刷卡記錄列表
function updateCardRecordsList() {
    const cardRecordsList = document.getElementById('cardRecordsList');
    cardRecordsList.innerHTML = '';
    
    // 按日期排序
    cardRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 計算總頁數
    const totalPages = Math.ceil(cardRecords.length / itemsPerPage);
    
    // 獲取當前頁的記錄
    const startIndex = (currentCardPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageRecords = cardRecords.slice(startIndex, endIndex);
    
    // 顯示當前頁的記錄
    currentPageRecords.forEach((record, index) => {
        const row = document.createElement('tr');
        const actualIndex = cardRecords.indexOf(record);
        row.innerHTML = `
            <td>${record.date}</td>
            <td>${getCategoryName(record.category || 'other')}</td>
            <td>${record.amount.toLocaleString()}</td>
            <td>${record.description}</td>
            <td>
                <button class="edit-btn" onclick="editCardRecord(${actualIndex})">
                    <i class="fas fa-edit"></i> 編輯
                </button>
                <button class="delete-btn" onclick="deleteCardRecord(${actualIndex})">
                    <i class="fas fa-trash"></i> 刪除
                </button>
            </td>
        `;
        cardRecordsList.appendChild(row);
    });
    
    // 更新分頁控制
    updateCardPagination(totalPages);
}

// 更新刷卡記錄分頁控制
function updateCardPagination(totalPages) {
    // 移除舊的分頁控制（如果存在）
    const oldPagination = document.querySelector('.card-records-list .pagination');
    if (oldPagination) {
        oldPagination.remove();
    }
    
    if (totalPages <= 1) {
        return; // 如果只有一頁或沒有資料，不顯示分頁控制
    }
    
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination';
    
    const maxPagesDisplay = 10; // 一次最多顯示10個頁面按鈕
    
    // 計算當前頁面組的範圍
    const currentGroup = Math.ceil(currentCardPage / maxPagesDisplay);
    const startPage = (currentGroup - 1) * maxPagesDisplay + 1;
    const endPage = Math.min(startPage + maxPagesDisplay - 1, totalPages);
    
    // 上一頁按鈕
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i> 上一頁';
    prevButton.disabled = currentCardPage === 1;
    prevButton.onclick = () => {
        if (currentCardPage > 1) {
            currentCardPage--;
            updateCardRecordsList();
        }
    };
    paginationContainer.appendChild(prevButton);
    
    // 上一組按鈕（如果不是第一組）
    if (startPage > 1) {
        const prevGroupButton = document.createElement('button');
        prevGroupButton.innerHTML = '<i class="fas fa-angle-double-left"></i>';
        prevGroupButton.title = '上一組頁面';
        prevGroupButton.onclick = () => {
            currentCardPage = startPage - 1;
            updateCardRecordsList();
        };
        paginationContainer.appendChild(prevGroupButton);
        
        // 顯示第一頁
        const firstPageButton = document.createElement('button');
        firstPageButton.innerHTML = '1';
        firstPageButton.onclick = () => {
            currentCardPage = 1;
            updateCardRecordsList();
        };
        paginationContainer.appendChild(firstPageButton);
        
        // 省略號
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.innerHTML = '...';
            ellipsis.className = 'pagination-ellipsis';
            paginationContainer.appendChild(ellipsis);
        }
    }
    
    // 頁碼按鈕（當前組的頁面）
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.innerHTML = i;
        pageButton.className = currentCardPage === i ? 'active' : '';
        pageButton.onclick = () => {
            currentCardPage = i;
            updateCardRecordsList();
        };
        paginationContainer.appendChild(pageButton);
    }
    
    // 下一組按鈕（如果不是最後一組）
    if (endPage < totalPages) {
        // 省略號
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.innerHTML = '...';
            ellipsis.className = 'pagination-ellipsis';
            paginationContainer.appendChild(ellipsis);
        }
        
        // 顯示最後一頁
        const lastPageButton = document.createElement('button');
        lastPageButton.innerHTML = totalPages;
        lastPageButton.onclick = () => {
            currentCardPage = totalPages;
            updateCardRecordsList();
        };
        paginationContainer.appendChild(lastPageButton);
        
        const nextGroupButton = document.createElement('button');
        nextGroupButton.innerHTML = '<i class="fas fa-angle-double-right"></i>';
        nextGroupButton.title = '下一組頁面';
        nextGroupButton.onclick = () => {
            currentCardPage = endPage + 1;
            updateCardRecordsList();
        };
        paginationContainer.appendChild(nextGroupButton);
    }
    
    // 下一頁按鈕
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '下一頁 <i class="fas fa-chevron-right"></i>';
    nextButton.disabled = currentCardPage === totalPages;
    nextButton.onclick = () => {
        if (currentCardPage < totalPages) {
            currentCardPage++;
            updateCardRecordsList();
        }
    };
    paginationContainer.appendChild(nextButton);
    
    // 添加分頁信息
    const paginationInfo = document.createElement('span');
    paginationInfo.className = 'pagination-info';
    paginationInfo.innerHTML = `第 ${currentCardPage} 頁，共 ${totalPages} 頁 (第 ${currentGroup} 組)`;
    paginationContainer.appendChild(paginationInfo);
    
    // 添加新的分頁控制
    document.querySelector('.card-records-list').appendChild(paginationContainer);
}

// 刪除刷卡記錄
function deleteCardRecord(index) {
    if (confirm('確定要刪除這筆刷卡記錄嗎？')) {
        const deletedRecord = cardRecords[index];
        cardRecords.splice(index, 1);
        localStorage.setItem('cardRecords', JSON.stringify(cardRecords));
        
        // 更新歷史月份限額記錄
        updateLimitHistoryWithDeletedRecord(deletedRecord);
        
        // 更新顯示
        updateCardRecordsList();
        updateCardUsage();
        updateCardCategoryStackedChart(); // 更新刷卡分類圖表
    }
}

// 更新歷史月份限額記錄（刪除記錄時）
function updateLimitHistoryWithDeletedRecord(deletedRecord) {
    const recordBillingCycle = getBillingCycleMonth(deletedRecord.date);
    
    // 找到對應月份的記錄
    const existingRecordIndex = limitHistory.findIndex(record => record.month === recordBillingCycle);
    
    if (existingRecordIndex !== -1) {
        // 更新現有記錄
        const record = limitHistory[existingRecordIndex];
        record.used -= parseFloat(deletedRecord.amount);
        record.remaining = record.limit - record.used;
        
        // 如果該月份沒有其他記錄了，可以選擇刪除該月份的記錄
        if (record.used === 0) {
            limitHistory.splice(existingRecordIndex, 1);
        }
        
        // 保存更新後的歷史記錄
        localStorage.setItem('limitHistory', JSON.stringify(limitHistory));
        updateLimitHistory();
    }
}

// 編輯刷卡記錄
function editCardRecord(index) {
    const record = cardRecords[index];
    if (!record) {
        alert('找不到要編輯的記錄！');
        return;
    }
    
    // 填入表單數據
    document.getElementById('cardDate').value = record.date;
    document.getElementById('cardAmount').value = record.amount;
    document.getElementById('cardCategory').value = record.category || 'other';
    document.getElementById('cardDescription').value = record.description;
    
    // 將表單滾動到視窗頂部
    document.querySelector('.card-records-management .form-container').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
    
    // 改變表單按鈕為更新模式
    const form = document.getElementById('cardExpenseForm');
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    const originalButtonColor = submitButton.style.backgroundColor;
    
    // 修改按鈕樣式和文字
    submitButton.innerHTML = '<i class="fas fa-save"></i> 更新刷卡記錄';
    submitButton.style.backgroundColor = '#17a2b8';
    
    // 添加數據屬性來標記編輯模式
    form.setAttribute('data-edit-index', index);
    form.setAttribute('data-original-button-text', originalButtonText);
    form.setAttribute('data-original-button-color', originalButtonColor);
    
    // 添加取消按鈕
    if (!form.querySelector('.cancel-edit-btn')) {
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'cancel-edit-btn';
        cancelButton.innerHTML = '<i class="fas fa-times"></i> 取消編輯';
        cancelButton.style.backgroundColor = '#6c757d';
        cancelButton.style.marginLeft = '10px';
        cancelButton.onclick = cancelCardEdit;
        submitButton.parentNode.insertBefore(cancelButton, submitButton.nextSibling);
    }
}

// 取消刷卡記錄編輯
function cancelCardEdit() {
    const form = document.getElementById('cardExpenseForm');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelButton = form.querySelector('.cancel-edit-btn');
    
    // 恢復按鈕原始狀態
    const originalButtonText = form.getAttribute('data-original-button-text');
    const originalButtonColor = form.getAttribute('data-original-button-color');
    
    submitButton.innerHTML = originalButtonText;
    submitButton.style.backgroundColor = originalButtonColor;
    
    // 移除編輯模式標記
    form.removeAttribute('data-edit-index');
    form.removeAttribute('data-original-button-text');
    form.removeAttribute('data-original-button-color');
    
    // 移除取消按鈕
    if (cancelButton) {
        cancelButton.remove();
    }
    
    // 重置表單
    form.reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('cardDate').value = today;
}

// 更新歷史月份限額記錄（編輯記錄時）
function updateLimitHistoryWithEditedRecord(oldRecord, newRecord) {
    // 處理舊記錄（減去舊金額）
    updateLimitHistoryWithDeletedRecord(oldRecord);
    // 處理新記錄（加上新金額）
    updateLimitHistoryWithNewRecord(newRecord);
}

// 處理刷卡記錄表單提交
document.getElementById('cardExpenseForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const date = document.getElementById('cardDate').value;
    const amount = parseFloat(document.getElementById('cardAmount').value);
    const category = document.getElementById('cardCategory').value;
    const description = document.getElementById('cardDescription').value;
    
    // 檢查是否為編輯模式
    const editIndex = this.getAttribute('data-edit-index');
    
    if (editIndex !== null) {
        // 編輯模式：更新現有記錄
        const index = parseInt(editIndex);
        if (index >= 0 && index < cardRecords.length) {
            // 檢查是否超過限額（編輯時需要排除原記錄的金額）
            const recordBillingCycle = getBillingCycleMonth(date);
            const currentBillingCycle = getCurrentBillingCycleMonth();
            const isCurrentBillingCycle = recordBillingCycle === currentBillingCycle;
            
            if (isCurrentBillingCycle) {
                const currentUsed = cardRecords.reduce((sum, record, i) => {
                    if (i === index) return sum; // 排除正在編輯的記錄
                    const recordBillingCycle = getBillingCycleMonth(record.date);
                    if (recordBillingCycle === currentBillingCycle) {
                        return sum + parseFloat(record.amount);
                    }
                    return sum;
                }, 0);
                
                if (currentUsed + amount > cardLimit) {
                    alert('此筆消費將超過本月信用卡限額！');
                    return;
                }
            }
            
            // 儲存舊記錄以便更新歷史限額
            const oldRecord = { ...cardRecords[index] };
            
            // 更新記錄
            cardRecords[index] = {
                date: date,
                amount: amount,
                category: category,
                description: description
            };
            
            // 更新歷史月份限額記錄
            updateLimitHistoryWithEditedRecord(oldRecord, cardRecords[index]);
            
            // 取消編輯模式
            cancelCardEdit();
            
            alert('刷卡記錄已成功更新！');
        } else {
            alert('找不到要更新的記錄！');
            return;
        }
    } else {
        // 新增模式
        // 檢查是否超過限額
        const recordBillingCycle = getBillingCycleMonth(date);
        const currentBillingCycle = getCurrentBillingCycleMonth();
        const isCurrentBillingCycle = recordBillingCycle === currentBillingCycle;
        
        // 如果是當前週期的記錄，才檢查限額
        if (isCurrentBillingCycle) {
            const currentUsed = cardRecords.reduce((sum, record) => {
                const recordBillingCycle = getBillingCycleMonth(record.date);
                if (recordBillingCycle === currentBillingCycle) {
                    return sum + parseFloat(record.amount);
                }
                return sum;
            }, 0);
            
            if (currentUsed + amount > cardLimit) {
                alert('此筆消費將超過本月信用卡限額！');
                return;
            }
        }
        
        // 新增記錄
        const newRecord = {
            date: date,
            amount: amount,
            category: category,
            description: description
        };
        
        cardRecords.push(newRecord);
        
        // 更新歷史月份限額記錄
        updateLimitHistoryWithNewRecord(newRecord);
        
        // 重置表單
        this.reset();
        document.getElementById('cardDate').value = new Date().toISOString().split('T')[0];
    }
    
    localStorage.setItem('cardRecords', JSON.stringify(cardRecords));
    
    // 更新顯示
    updateCardRecordsList();
    updateCardUsage();
    updateCardCategoryStackedChart(); // 更新刷卡分類圖表
});

// 更新歷史月份限額記錄
function updateLimitHistoryWithNewRecord(newRecord) {
    const recordBillingCycle = getBillingCycleMonth(newRecord.date);
    
    // 檢查是否已存在該月份的記錄
    const existingRecordIndex = limitHistory.findIndex(record => record.month === recordBillingCycle);
    
    if (existingRecordIndex !== -1) {
        // 更新現有記錄
        const record = limitHistory[existingRecordIndex];
        record.used += parseFloat(newRecord.amount);
        record.remaining = record.limit - record.used;
    } else {
        // 創建新記錄
        const isCurrentBillingCycle = recordBillingCycle === getCurrentBillingCycleMonth();
        const newHistoryRecord = {
            month: recordBillingCycle,
            limit: isCurrentBillingCycle ? cardLimit : 20000, // 如果是當前週期使用當前限額，否則使用20000
            used: parseFloat(newRecord.amount),
            remaining: isCurrentBillingCycle ? cardLimit - parseFloat(newRecord.amount) : 20000 - parseFloat(newRecord.amount)
        };
        limitHistory.unshift(newHistoryRecord);
    }
    
    // 保存更新後的歷史記錄
    localStorage.setItem('limitHistory', JSON.stringify(limitHistory));
    updateLimitHistory();
}

// 更新歷史記錄
function updateLimitHistory() {
    const currentBillingCycle = getCurrentBillingCycleMonth();
    
    // 計算當前週期已使用金額
    const currentBillingCycleUsed = cardRecords
        .filter(record => {
            const recordBillingCycle = getBillingCycleMonth(record.date);
            return recordBillingCycle === currentBillingCycle;
        })
        .reduce((sum, record) => sum + parseFloat(record.amount), 0);
    
    // 更新當前週期記錄
    const currentBillingCycleRecord = {
        month: currentBillingCycle,
        limit: cardLimit,
        used: currentBillingCycleUsed,
        remaining: cardLimit - currentBillingCycleUsed
    };
    
    // 更新或添加當前週期記錄
    const existingIndex = limitHistory.findIndex(record => record.month === currentBillingCycleRecord.month);
    if (existingIndex !== -1) {
        limitHistory[existingIndex] = currentBillingCycleRecord;
    } else {
        limitHistory.unshift(currentBillingCycleRecord);
    }
    
    // 儲存更新後的歷史記錄
    localStorage.setItem('limitHistory', JSON.stringify(limitHistory));
    
    // 更新歷史記錄顯示
    updateLimitHistoryDisplay();
}

// 更新歷史記錄顯示
function updateLimitHistoryDisplay() {
    const historyList = document.getElementById('limitHistoryList');
    historyList.innerHTML = '';
    
    // 確保 limitHistory 是陣列
    if (!Array.isArray(limitHistory)) {
        limitHistory = [];
    }
    
    // 按月份排序（從新到舊）
    limitHistory.sort((a, b) => b.month.localeCompare(a.month));
    
    limitHistory.forEach((record, index) => {
        const usageRate = ((record.used / record.limit) * 100).toFixed(1);
        const usageClass = usageRate >= 80 ? 'high-usage' : 
                          usageRate >= 50 ? 'medium-usage' : '';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.month}</td>
            <td>
                <input type="number" value="${record.limit}" min="0" step="1000" 
                       style="width: 100px; text-align: center; border: 1px solid var(--navy-blue); border-radius: 5px; padding: 5px;"
                       onchange="updateHistoryLimit(${index}, this.value)">
                元
            </td>
            <td>${record.used.toLocaleString()} 元</td>
            <td>${record.remaining.toLocaleString()} 元</td>
            <td class="${usageClass}">${usageRate}%</td>
            <td>
                <button class="delete-btn" onclick="deleteLimitHistory(${index})">
                    <i class="fas fa-trash"></i> 刪除
                </button>
            </td>
        `;
        historyList.appendChild(row);
    });
}

// 更新歷史月份限額
function updateHistoryLimit(index, newLimit) {
    const newLimitValue = parseFloat(newLimit) || 0;
    if (newLimitValue < 0) {
        alert('限額不能為負數！');
        updateLimitHistoryDisplay(); // 重新顯示以恢復原值
        return;
    }
    
    // 更新限額
    limitHistory[index].limit = newLimitValue;
    limitHistory[index].remaining = newLimitValue - limitHistory[index].used;
    
    // 保存到本地存儲
    localStorage.setItem('limitHistory', JSON.stringify(limitHistory));
    
    // 重新顯示以更新剩餘額度和使用率
    updateLimitHistoryDisplay();
    
    // 顯示成功訊息
    console.log(`已更新 ${limitHistory[index].month} 的限額為 ${newLimitValue.toLocaleString()} 元`);
}

// 刪除歷史月份限額記錄
function deleteLimitHistory(index) {
    if (confirm('確定要刪除這筆歷史月份限額記錄嗎？')) {
        limitHistory.splice(index, 1);
        localStorage.setItem('limitHistory', JSON.stringify(limitHistory));
        updateLimitHistoryDisplay();
    }
}

// 更新總限額顯示
function updateTotalLimit() {
    const totalLimit = parseFloat(document.getElementById('totalLimit').value) || 0;
    const usedAmount = parseFloat(document.getElementById('usedAmount').textContent.replace(/,/g, '')) || 0;
    
    // 更新剩餘額度顯示
    const remainingAmount = totalLimit - usedAmount;
    document.getElementById('remainingAmount').textContent = remainingAmount.toLocaleString();
    
    // 更新 cardLimit
    cardLimit = totalLimit;
    localStorage.setItem('cardLimit', cardLimit.toString());
    
    // 更新歷史記錄中的限額
    updateLimitHistory();
}

// 監聽總限額輸入變化
document.getElementById('totalLimit').addEventListener('change', function() {
    const newLimit = parseFloat(this.value) || 0;
    if (newLimit < 0) {
        this.value = 0;
    }
    updateTotalLimit();
});

// 更新帳戶餘額顯示
function updateBalanceDisplay() {
    // 獲取最新餘額
    const latestBalances = getLatestBalances();
    
    // 更新郵局帳戶
    const postPercentage = (latestBalances.post / accountLimits.post) * 100;
    document.getElementById('postProgress').style.height = `${postPercentage}%`;
    document.getElementById('postAmount').textContent = latestBalances.post.toLocaleString();
    
    // 更新簽帳卡
    const bankPercentage = (latestBalances.bank / accountLimits.bank) * 100;
    document.getElementById('bankProgress').style.height = `${bankPercentage}%`;
    document.getElementById('bankAmount').textContent = latestBalances.bank.toLocaleString();
    
    // 更新支付寶
    const alipayPercentage = (latestBalances.alipay / accountLimits.alipay) * 100;
    document.getElementById('alipayProgress').style.height = `${alipayPercentage}%`;
    document.getElementById('alipayAmount').textContent = latestBalances.alipay.toLocaleString();
}

// 獲取最新餘額
function getLatestBalances() {
    const balances = {
        post: 0,
        bank: 0,
        alipay: 0
    };
    
    // 按日期排序
    balanceRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 獲取每種帳戶的最新餘額
    const processedAccounts = new Set();
    balanceRecords.forEach(record => {
        if (!processedAccounts.has(record.type)) {
            balances[record.type] = record.amount;
            processedAccounts.add(record.type);
        }
    });
    
    return balances;
}

// 初始化餘額趨勢圖
function initBalanceChart() {
    // 郵局帳戶趨勢圖
    const postCtx = document.getElementById('postTrendChart').getContext('2d');
    window.postChart = new Chart(postCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '郵局帳戶餘額',
                borderColor: '#4a9d8f',
                backgroundColor: 'rgba(74, 157, 143, 0.1)',
                data: []
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '金額 (台幣)'
                    }
                }
            }
        }
    });

    // 簽帳卡趨勢圖
    const bankCtx = document.getElementById('bankTrendChart').getContext('2d');
    window.bankChart = new Chart(bankCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '簽帳卡餘額',
                borderColor: '#e67e5d',
                backgroundColor: 'rgba(230, 126, 93, 0.1)',
                data: []
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '金額 (台幣)'
                    }
                }
            }
        }
    });

    // 支付寶趨勢圖
    const alipayCtx = document.getElementById('alipayTrendChart').getContext('2d');
    window.alipayChart = new Chart(alipayCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '支付寶餘額',
                borderColor: '#7c9cbf',
                backgroundColor: 'rgba(124, 156, 191, 0.1)',
                data: []
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '金額 (人民幣)'
                    }
                }
            }
        }
    });
    
    updateBalanceChart();
}

// 更新餘額趨勢圖
function updateBalanceChart() {
    // 獲取所有日期
    const dates = [...new Set(balanceRecords.map(record => record.date))].sort();
    
    // 準備數據
    const postData = new Array(dates.length).fill(null);
    const bankData = new Array(dates.length).fill(null);
    const alipayData = new Array(dates.length).fill(null);
    
    // 填充數據
    balanceRecords.forEach(record => {
        const index = dates.indexOf(record.date);
        if (index !== -1) {
            switch (record.type) {
                case 'post':
                    postData[index] = record.amount;
                    break;
                case 'bank':
                    bankData[index] = record.amount;
                    break;
                case 'alipay':
                    alipayData[index] = record.amount;
                    break;
            }
        }
    });
    
    // 更新圖表
    window.postChart.data.labels = dates;
    window.postChart.data.datasets[0].data = postData;
    window.postChart.update();

    window.bankChart.data.labels = dates;
    window.bankChart.data.datasets[0].data = bankData;
    window.bankChart.update();

    window.alipayChart.data.labels = dates;
    window.alipayChart.data.datasets[0].data = alipayData;
    window.alipayChart.update();
}

// 處理餘額更新表單提交
document.getElementById('balanceForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const date = document.getElementById('balanceDate').value;
    const type = document.getElementById('accountType').value;
    const amount = parseFloat(document.getElementById('balanceAmount').value);
    const description = document.getElementById('balanceDescription').value;
    
    // 檢查是否超過限額
    if (amount > accountLimits[type]) {
        alert(`此金額超過${type === 'post' ? '郵局帳戶' : type === 'bank' ? '簽帳卡' : '支付寶'}的限額！`);
        return;
    }
    
    // 檢查日期是否超過今天
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate.getTime() > today.getTime()) {
        alert('不能輸入未來日期的餘額！');
        return;
    }
    
    // 更新或新增記錄
    const index = balanceRecords.findIndex(record => 
        record.date === date && record.type === type
    );
    
    if (index !== -1) {
        balanceRecords[index].amount = amount;
        balanceRecords[index].description = description;
    } else {
        balanceRecords.push({
            date: date,
            type: type,
            amount: amount,
            description: description
        });
    }
    
    // 按日期排序
    balanceRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // 儲存到本地存儲
    localStorage.setItem('balanceRecords', JSON.stringify(balanceRecords));
    
    // 更新所有顯示
    updateBalanceDisplay();  // 更新錢袋子顯示
    updateBalanceChart();    // 更新趨勢圖
    updateBalanceLineChart(); // 更新折線圖
    updateBalanceBarChart();  // 更新柱狀圖
    updateBalanceRecordsList(); // 更新記錄列表
    
    // 重置表單
    this.reset();
    document.getElementById('balanceDate').value = new Date().toISOString().split('T')[0];
});

// 檢查是否需要更新本月限額
function checkAndUpdateMonthlyLimit() {
    const today = new Date();
    
    // 檢查是否為每月5號（新的刷卡週期開始日）
    if (today.getDate() === 5) {
        // 檢查是否已經更新過本月限額
        const lastUpdate = localStorage.getItem('lastLimitUpdate');
        const lastUpdateDate = lastUpdate ? new Date(lastUpdate) : null;
        
        if (!lastUpdateDate || lastUpdateDate.getDate() !== 5 || 
            lastUpdateDate.getMonth() !== today.getMonth() || 
            lastUpdateDate.getFullYear() !== today.getFullYear()) {
            
            // 計算上個刷卡週期的使用金額
            const lastBillingCycle = getBillingCycleMonth(new Date(today.getFullYear(), today.getMonth(), 4)); // 上個週期的最後一天
            const lastBillingCycleUsed = cardRecords.reduce((sum, record) => {
                const recordBillingCycle = getBillingCycleMonth(record.date);
                if (recordBillingCycle === lastBillingCycle) {
                    return sum + parseFloat(record.amount);
                }
                return sum;
            }, 0);
            
            // 添加上個刷卡週期的記錄到歷史記錄中
            const lastBillingCycleRecord = {
                month: lastBillingCycle,
                limit: cardLimit,
                used: lastBillingCycleUsed,
                remaining: cardLimit - lastBillingCycleUsed
            };
            
            // 確保 limitHistory 是陣列
            if (!Array.isArray(limitHistory)) {
                limitHistory = [];
            }
            
            limitHistory.unshift(lastBillingCycleRecord);
            localStorage.setItem('limitHistory', JSON.stringify(limitHistory));
            
            // 重置當前週期記錄
            cardRecords = [];
            localStorage.setItem('cardRecords', JSON.stringify(cardRecords));
            
            // 更新最後更新時間
            localStorage.setItem('lastLimitUpdate', today.toISOString());
            
            // 更新顯示
            updateCardUsage();
            updateCardRecordsList();
            updateLimitHistory();
        }
    }
}

// 資料備份功能
function exportData() {
    const data = {
        records: JSON.parse(localStorage.getItem('records')) || [],
        cardRecords: JSON.parse(localStorage.getItem('cardRecords')) || [],
        cardLimit: localStorage.getItem('cardLimit') || 19872,
        balanceRecords: JSON.parse(localStorage.getItem('balanceRecords')) || [],
        limitHistory: JSON.parse(localStorage.getItem('limitHistory')) || []
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `記帳本備份_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 資料還原功能
function importData() {
    document.getElementById('importFile').click();
}

// 處理檔案上傳
document.getElementById('importFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // 確認資料格式
                if (!data.records || !data.cardRecords || !data.balanceRecords || !data.limitHistory) {
                    throw new Error('無效的備份檔案格式');
                }
                
                // 還原資料
                localStorage.setItem('records', JSON.stringify(data.records));
                localStorage.setItem('cardRecords', JSON.stringify(data.cardRecords));
                localStorage.setItem('cardLimit', data.cardLimit);
                localStorage.setItem('balanceRecords', JSON.stringify(data.balanceRecords));
                localStorage.setItem('limitHistory', JSON.stringify(data.limitHistory));
                
                // 更新全域變數
                records = data.records;
                cardRecords = data.cardRecords;
                cardLimit = data.cardLimit;
                balanceRecords = data.balanceRecords;
                limitHistory = data.limitHistory;
                
                // 更新顯示
                updateRecordsList();
                updateStats();
                initMonthSelector(); // 重新初始化月份選擇器
                updateCharts();
                updateCardRecordsList();
                updateCardUsage();
                updateBalanceDisplay();
                updateBalanceChart();
                updateLimitHistory();
                
                alert('資料還原成功！');
            } catch (error) {
                alert('還原失敗：' + error.message);
            }
        };
        reader.readAsText(file);
    }
});

// 更新支出分類圖表
function updateExpenseChart() {
    const expenseData = {};
    const expenseColors = {
        'food': '#FF6384',
        'transport': '#36A2EB',
        'shopping': '#FFCE56',
        'entertainment': '#FF6B9D',
        'savings': '#4BC0C0',
        'payment': '#9966FF',
        'fee': '#FF9F40',
        'other': '#C9CBCF'
    };
    
    // 定義所有支出類別（排除收入類別）
    const allExpenseCategories = ['food', 'transport', 'shopping', 'entertainment', 'savings', 'payment', 'fee', 'other'];
    
    // 初始化所有支出類別為0
    allExpenseCategories.forEach(category => {
        expenseData[category] = 0;
    });
    
    // 計算各類別支出總額
    records.forEach(record => {
        if (record.type === 'expense' && expenseData.hasOwnProperty(record.category)) {
            expenseData[record.category] += record.amount;
        }
    });
    
    // 準備圖表數據
    const labels = allExpenseCategories.map(category => getCategoryName(category));
    const data = allExpenseCategories.map(category => expenseData[category]);
    const backgroundColors = allExpenseCategories.map(category => expenseColors[category] || '#C9CBCF');
    
    // 更新圖表
    window.categoryChart.data.labels = labels;
    window.categoryChart.data.datasets[0].data = data;
    window.categoryChart.data.datasets[0].backgroundColor = backgroundColors;
    window.categoryChart.update();
}

// 更新刷卡分類堆疊條形圖
function updateCardCategoryStackedChart() {
    const cardCategoryAmount = {};
    const cardCategoryCount = {};
    
    // 定義刷卡記錄的所有類別（不包含薪資和儲蓄）
    const cardCategories = ['food', 'transport', 'shopping', 'entertainment', 'payment', 'fee', 'other'];
    
    // 初始化所有類別為0
    cardCategories.forEach(category => {
        cardCategoryAmount[category] = 0;
        cardCategoryCount[category] = 0;
    });
    
    // 計算各類別刷卡總額和次數
    cardRecords.forEach(record => {
        const category = record.category || 'other';
        if (cardCategoryAmount.hasOwnProperty(category)) {
            cardCategoryAmount[category] += parseFloat(record.amount);
            cardCategoryCount[category] += 1;
        }
    });
    
    // 計算總金額和總次數
    const totalAmount = Object.values(cardCategoryAmount).reduce((sum, amount) => sum + amount, 0);
    const totalCount = Object.values(cardCategoryCount).reduce((sum, count) => sum + count, 0);
    
    // 計算金額百分比和次數百分比
    const amountPercentageData = {};
    const countPercentageData = {};
    
    if (totalAmount > 0) {
        cardCategories.forEach(category => {
            amountPercentageData[category] = (cardCategoryAmount[category] / totalAmount) * 100;
        });
    } else {
        cardCategories.forEach(category => {
            amountPercentageData[category] = 0;
        });
    }
    
    if (totalCount > 0) {
        cardCategories.forEach(category => {
            countPercentageData[category] = (cardCategoryCount[category] / totalCount) * 100;
        });
    } else {
        cardCategories.forEach(category => {
            countPercentageData[category] = 0;
        });
    }
    
    // 更新圖表數據
    window.cardCategoryStackedChart.data.datasets.forEach((dataset, index) => {
        const category = cardCategories[index];
        if (category) {
            dataset.data = [
                amountPercentageData[category], // 金額比例
                countPercentageData[category]   // 次數比例
            ];
        }
    });
    
    window.cardCategoryStackedChart.update();
}

// 更新餘額趨勢圖表
function updateBalanceTrendChart() {
    const ctx = document.getElementById('balanceTrendChart').getContext('2d');
    
    // 按日期排序（從舊到新）
    const sortedRecords = [...balanceRecords].sort((a, b) => a.date.localeCompare(b.date));
    
    const data = {
        labels: sortedRecords.map(record => record.date),
        datasets: [{
            label: '帳戶餘額',
            data: sortedRecords.map(record => record.amount),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
            fill: false
        }]
    };
    
    const config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '餘額趨勢'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + ' 元';
                        }
                    }
                }
            }
        }
    };
    
    // 如果圖表已存在，則更新它
    if (window.balanceTrendChart) {
        window.balanceTrendChart.data = data;
        window.balanceTrendChart.update();
    } else {
        // 否則創建新的圖表
        window.balanceTrendChart = new Chart(ctx, config);
    }
}

// 更新帳戶餘額
function updateBalance() {
    const date = document.getElementById('balanceDate').value;
    const amount = parseFloat(document.getElementById('balanceAmount').value);
    
    if (isNaN(amount)) {
        alert('請輸入有效的金額！');
        return;
    }
    
    // 新增餘額記錄
    const newRecord = {
        date: date,
        amount: amount
    };
    
    balanceRecords.unshift(newRecord);
    localStorage.setItem('balanceRecords', JSON.stringify(balanceRecords));
    
    // 更新顯示
    updateBalanceDisplay();
    
    // 更新餘額趨勢圖表
    if (window.balanceTrendChart) {
        const sortedRecords = [...balanceRecords].sort((a, b) => a.date.localeCompare(b.date));
        window.balanceTrendChart.data.labels = sortedRecords.map(record => record.date);
        window.balanceTrendChart.data.datasets[0].data = sortedRecords.map(record => record.amount);
        window.balanceTrendChart.update();
    }
    
    // 清空輸入框
    document.getElementById('balanceAmount').value = '';
}

// 修改 deleteBalanceRecord 函數
function deleteBalanceRecord(index) {
    if (confirm('確定要刪除這筆餘額記錄嗎？')) {
        balanceRecords.splice(index, 1);
        localStorage.setItem('balanceRecords', JSON.stringify(balanceRecords));
        updateBalanceDisplay();
        updateBalanceTrendChart();  // 添加這行來更新餘額趨勢圖表
    }
} 
