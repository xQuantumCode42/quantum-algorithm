export type Template = { id: string; title: string; category: string; code: string; guide: string };

const groups: Template[] = [];
function add(id: string, title: string, category: string, code: string, guide: string) {
  groups.push({ id, title, category, code: code.trim(), guide: guide.trim() });
}

add("dsu", "並查集 DSU", "資料結構", `
#include <numeric>
#include <vector>
#include <utility>
struct DSU {
    std::vector<int> parent, size;
    explicit DSU(int n): parent(n), size(n, 1) {
        std::iota(parent.begin(), parent.end(), 0);
    }
    int find(int x) {
        while (x != parent[x]) x = parent[x] = parent[parent[x]];
        return x;
    }
    bool unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return false;
        if (size[a] < size[b]) std::swap(a, b);
        parent[b] = a;
        size[a] += size[b];
        return true;
    }
};
`, `
## 什麼時候用
你有 n 個點，不斷加邊，想知道任兩點是否已經連通。把每個連通塊想成一棵樹，樹根是這一組的代表。
## 怎麼運作
一開始每個點的父親是自己。find 沿父指標往上找根，同時讓走過的點跳到祖父，下一次查詢就會更快。unite 找到兩棵樹的根，把較小的樹接到較大的樹。
## 連通塊示意
\`\`\`graph
0 1
2 3
\`\`\`
## 手推
DSU(4) 建立 0 到 3。unite(0, 1) 和 unite(2, 3) 後有兩組。再 unite(1, 2)，find(0) 和 find(3) 就相等。如果再次合併 0、3，unite 回傳 false，因為兩點早已連通。
## 成本與限制
初始化 O(n)，合併及查詢攤銷 O(α(n))，空間 O(n)。適合 Kruskal 和只加邊的連通性。普通 DSU 無法刪邊。
`);

add("bit", "Fenwick Tree / BIT", "資料結構", `
#include <vector>
struct Fenwick {
    int n; std::vector<long long> tree;
    explicit Fenwick(int size): n(size), tree(n+1) {}
    void add(int i, long long value) {
        for (++i; i <= n; i += i & -i) tree[i] += value;
    }
    long long prefix(int r) const {
        long long sum = 0;
        for (; r > 0; r -= r & -r) sum += tree[r];
        return sum;
    }
    long long range(int l, int r) const { return prefix(r) - prefix(l); }
};
`, `
## 什麼時候用
陣列會變動，而且常問一段的總和。普通前綴和查很快，但改一個值要重算後面很多格。
## 怎麼運作
內部用 1-based。位置 i 管理右端是 i、長度是 i & -i 的一段。例如 6 的二進位是 110，最低位 1 代表 2，所以它管理位置 5、6。查 prefix 時每次扣掉這段長度，拼成完整前綴；更新時則往包含目前位置的更大區段跳。
## 手推
加入 [2, 4, 1] 後，prefix(2) 為 6，range(1, 3) 為 5。若第 1 格由 4 改為 7，呼叫 add(1, 3)。
## 成本與限制
add、prefix、range 都是 O(log n)，空間 O(n)。外部索引從 0 開始，區間 [l,r) 不含 r，add 的 i 必須在 [0,n)。
`);

add("segment", "線段樹 Segment Tree", "資料結構", `
#include <vector>
struct SegmentTree {
    int size = 1; std::vector<long long> tree;
    explicit SegmentTree(int n) {
        while (size < n) size *= 2;
        tree.assign(2 * size, 0);
    }
    void set(int i, long long v) {
        tree[i += size] = v;
        while (i > 1) { i /= 2; tree[i] = tree[2*i] + tree[2*i+1]; }
    }
    long long sum(int l, int r) const {
        long long ans = 0;
        for (l += size, r += size; l < r; l /= 2, r /= 2) {
            if (l & 1) ans += tree[l++];
            if (r & 1) ans += tree[--r];
        }
        return ans;
    }
};
`, `
## 什麼時候用
需要更新單格並查區間資訊。此版本求和，也可把合併運算換成 min、max 或 gcd，並換掉初始值。
## 怎麼運作
葉節點是原陣列，父節點存左右兩段合併結果。更新葉子後沿父節點回算。查 [l,r) 時，如果左邊界是右子節點，就先拿走它；如果右邊界切到一組子節點中間，就先拿它左邊那段。剩下的區間可整對往上搬。
## 手推
[3,1,4,2] 的根是 10。sum(1,3) 取 1 和 4 得 5。set(2,7) 只需要改第三個葉子、它的父親和根。
## 成本與限制
單點更新、區間查詢 O(log n)，空間 O(n)。索引從 0 開始，右界不包含。區間更新需要額外的 lazy propagation。
`);

add("trie", "字典樹 Trie", "字串", `
#include <array>
#include <string>
#include <vector>
struct Trie {
    struct Node {
        std::array<int, 26> next{};
        bool word = false;
    };
    std::vector<Node> nodes{Node{}};
    void insert(const std::string& s) {
        int p = 0;
        for (char c : s) {
            int i = c - 'a';
            if (!nodes[p].next[i]) {
                nodes[p].next[i] = nodes.size();
                nodes.emplace_back();
            }
            p = nodes[p].next[i];
        }
        nodes[p].word = true;
    }
    bool contains(const std::string& s, bool prefix = false) const {
        int p = 0;
        for (char c : s) {
            p = nodes[p].next[c - 'a'];
            if (!p) return false;
        }
        return prefix || nodes[p].word;
    }
};
`, `
## 什麼時候用
要存許多單字，並查某個前綴有沒有出現。共同前綴只存一次。
## 怎麼運作
從根出發，每條邊代表一個字母。插入時走到不存在的邊就建節點，最後一格標記為完整單字。
## 手推
插入 cat 和 car，兩者共用 c→a。contains("ca", true) 為真，contains("ca") 為假，因為 ca 的節點沒有完整單字標記。
## 成本與限制
插入和查詢 O(L)，L 是輸入字串長度。這份模板只接收小寫英文字母。
`);

add("xor-trie", "0/1 Trie 最大 XOR", "資料結構", `
#include <array>
#include <cstdint>
#include <vector>
struct XorTrie {
    std::vector<std::array<int,2>> next{{0,0}};
    void insert(std::uint32_t x) {
        int p = 0;
        for (int i = 31; i >= 0; --i) {
            int b = (x >> i) & 1;
            if (!next[p][b]) { next[p][b] = next.size(); next.push_back({0,0}); }
            p = next[p][b];
        }
    }
    std::uint32_t max_xor(std::uint32_t x) const {
        int p = 0;
        std::uint32_t result = 0;
        for (int i = 31; i >= 0; --i) {
            int b = (x >> i) & 1;
            if (next[p][b ^ 1]) { result |= std::uint32_t{1} << i; b ^= 1; }
            p = next[p][b];
        }
        return result;
    }
};
`, `
## 怎麼運作
把數字寫成固定 32 位元，每個節點最多有 0 和 1 兩條邊。找最大 XOR 時從最高位開始，若對面那一位存在，就走對面，讓答案這位為 1。任何低位的總和都無法超過一個更高位。
## 手推
已插入 3（011）和 5（101）。查 2（010）時，最高位想選 1，於是走向 5，回傳 2 XOR 5 = 7。
## 成本與限制
插入、查詢各走 32 層，空間最多 O(32n)。先至少插入一個數。回傳的是 XOR 結果。
`);

add("sieve", "埃拉托斯特尼篩法", "數論", `
#include <vector>
std::vector<bool> sieve(int n) {
    std::vector<bool> prime(n+1, true);
    prime[0] = false;
    if (n >= 1) prime[1] = false;
    for (int p = 2; p <= n / p; ++p) if (prime[p]) {
        for (long long k = 1LL*p*p; k <= n; k += p) prime[k] = false;
    }
    return prime;
}
`, `
## 原理
質數只有 1 和自身兩個正因數。從 2 開始，看到還沒被刪掉的數 p，就把 p 的倍數標成合數。
## 為何從 p² 開始
比 p² 小的 p 倍數必定有更小的因數，已經在之前處理過。例如篩 5 時，10 和 15 已可由 2 或 3 刪掉。每個合數至少有一個不超過平方根的因數。
## 手推與限制
sieve(10) 後 2、3、5、7 為真。n 必須非負。時間 O(n log log n)，空間 O(n)。
`);

add("treap", "隨機平衡樹 Treap", "資料結構", `
#include <cstdint>
#include <random>
#include <vector>
struct Treap {
    struct Node { int key; std::uint32_t priority; int left=0, right=0; };
    std::vector<Node> nodes{Node{0,0}};
    std::mt19937 rng{std::random_device{}()};
    int root = 0;
    void split(int p, int key, int& l, int& r) {
        if (!p) { l = r = 0; return; }
        if (nodes[p].key < key) {
            l = p; split(nodes[p].right, key, nodes[p].right, r);
        } else {
            r = p; split(nodes[p].left, key, l, nodes[p].left);
        }
    }
    int merge(int l, int r) {
        if (!l || !r) return l ? l : r;
        if (nodes[l].priority > nodes[r].priority) {
            nodes[l].right = merge(nodes[l].right, r); return l;
        }
        nodes[r].left = merge(l, nodes[r].left); return r;
    }
    bool contains(int key) const {
        int p = root;
        while (p && nodes[p].key != key)
            p = key < nodes[p].key ? nodes[p].left : nodes[p].right;
        return p != 0;
    }
    void insert(int key) {
        if (contains(key)) return;
        int l, r;
        split(root, key, l, r);
        nodes.push_back({key, static_cast<std::uint32_t>(rng())});
        root = merge(merge(l, nodes.size()-1), r);
    }
};
`, `
## 原理
每個節點有鍵值和隨機優先級。鍵值遵守二元搜尋樹，優先級遵守最大堆。優先級隨機化後，即使鍵值依排序順序插入，也不容易形成一條長鏈。
## Split 與 Merge
split(p,k) 把樹分成鍵值小於 k 與至少 k 的兩棵樹。merge 接兩棵已有順序的樹，優先級大的根留下，另一棵遞迴接到它靠近分界的子樹。
## 手推
已存 2、5，插入 3 時先分成 {2} 和 {5}，建 3 的節點，再從左到右合併。中序走訪仍會得到 2、3、5。
## 成本與限制
查詢和插入期望 O(log n)，最壞 O(n)。這份模板是無重複元素集合，尚未維護子樹大小。
`);

add("dijkstra", "Dijkstra 最短路", "圖論", `
#include <functional>
#include <limits>
#include <queue>
#include <utility>
#include <vector>
using Edge = std::pair<int, long long>;
std::vector<long long> dijkstra(const std::vector<std::vector<Edge>>& graph, int source) {
    const long long inf = std::numeric_limits<long long>::max();
    std::vector<long long> dist(graph.size(), inf);
    using Item = std::pair<long long,int>;
    std::priority_queue<Item,std::vector<Item>,std::greater<Item>> queue;
    queue.push({0,source}); dist[source] = 0;
    while (!queue.empty()) {
        auto [d,u] = queue.top(); queue.pop();
        if (d != dist[u]) continue;
        for (auto [v,w] : graph[u]) if (w <= inf - d && d+w < dist[v]) {
            dist[v] = d+w; queue.push({dist[v],v});
        }
    }
    return dist;
}
`, `
## 何時使用
所有邊權非負，想知道一個起點到其他點的最短距離。邊權都等於 1 時，BFS 更簡單。
## 原理
堆每次取出目前最小的候選距離。此時走任何額外的邊都只會增加距離，因此這個最小值已確定。沿每條出邊試著改善鄰點距離。堆中保留舊值，取出時用 dist 比對過濾。
## 路徑示意
\`\`\`graph
0 1 9
0 2 2
2 1 3
\`\`\`
## 手推
0→1 權重 9，0→2 權重 2，2→1 權重 3。先取 2，將 1 的候選從 9 改成 5。舊的 9 最後會被跳過。
## 成本與限制
二元堆版本時間 O((V+E) log(E+1))，空間 O(V+E)。不可有負邊，沒走到的點維持最大值。
`);

add("kmp", "KMP 字串比對", "字串", `
#include <string>
#include <vector>
std::vector<int> kmp(const std::string& text, const std::string& pattern) {
    if (pattern.empty()) return {};
    int m = pattern.size();
    std::vector<int> prefix(m), hits;
    for (int i=1,j=0; i<m; ++i) {
        while (j && pattern[i] != pattern[j]) j = prefix[j-1];
        if (pattern[i] == pattern[j]) ++j;
        prefix[i] = j;
    }
    for (int i=0,j=0; i<static_cast<int>(text.size()); ++i) {
        while (j && text[i] != pattern[j]) j = prefix[j-1];
        if (text[i] == pattern[j]) ++j;
        if (j == m) { hits.push_back(i-m+1); j = prefix[j-1]; }
    }
    return hits;
}
`, `
## 原理
匹配失敗時，已比對的尾巴可能剛好也是模式的開頭。prefix[i] 記錄模式前 i+1 個字元中，最長的相同真前綴和尾綴長度。發生衝突就跳到這個較短長度，保住已知的匹配。
## 手推
在 ababa 找 aba。第一個命中後，尾巴的 a 仍可當下一個開頭，所以在位置 0 和 2 都命中。
## 成本與限制
時間 O(n+m)，額外空間 O(m) 加上輸出。索引從 0 開始。空模式回傳空結果。
`);

add("modpow", "二進位快速冪", "數論", `
long long mod_pow(long long base, unsigned long long exponent, int mod) {
    base = (base % mod + mod) % mod;
    long long answer = 1 % mod;
    while (exponent) {
        if (exponent & 1) answer = answer * base % mod;
        base = base * base % mod;
        exponent >>= 1;
    }
    return answer;
}
`, `
## 原理
把指數拆成二進位，例如 13 = 8 + 4 + 1。反覆平方產生 a¹、a²、a⁴、a⁸，指數該位是 1 才乘入答案。每次取模可以保留最後正確的餘數。
## 手推
mod_pow(3,5,7) 乘入 3¹ 與 3⁴ 的餘數，得到 5。
## 成本與限制
O(log exponent) 時間與 O(1) 空間。mod 必須為正的 int，乘法使用 long long。
`);

export const builtInTemplates = groups;

const extra: [string,string,string,string,string,string][] = [
["bfs","BFS 廣度優先搜尋","圖論","queue","無權圖的最短路等於最少經過的邊數。隊列先處理距離較小的點，第一次發現鄰點就是最短路。","0 連到 1、2，1 再連到 3。從 0 出發，3 在第二層，距離是 2。"],
["topo","拓撲排序","圖論","queue","入度是尚未完成的前置工作數。先拿入度 0 的點，再移除它的出邊。若結果少於 n，剩下的點含有環。","A、B 都指向 C。可以先拿 A 或 B，但 C 必須等兩者都處理完。"],
["floyd","Floyd–Warshall 全點對最短路","圖論","matrix","外層的 k 控制目前允許哪些點當中繼站。比較原路徑和先到 k 再出發的路徑。","0→2 原本要 10，0→1 和 1→2 各要 3。允許 1 作中繼後變成 6。"],
["gcd","歐幾里得演算法與 GCD","數論","math","若 a = qb+r，a 和 b 的公因數也整除 r，所以可用 (b,r) 取代 (a,b)。","gcd(24,18) → gcd(18,6) → gcd(6,0) = 6。"],
["spf","最小質因數分解 SPF","數論","sieve","依質數遞增遍歷，第一次碰到合數時記下這個質數。分解時反覆除去目前最小的質因數。","84 → 42 → 21 → 7 → 1，依序取到 2、2、3、7。"],
["z","Z Algorithm","字串","string","z[i] 表示從 i 開始和原字串前綴相同的長度。維護最右的匹配區間，先複用區間內已知的答案，再向右延伸。","aaaa 的 z 陣列是 [0,3,2,1]。"],
["lis","最長遞增子序列 LIS","動態規劃","vector","tails[k] 是長度 k+1 的遞增序列所能有的最小結尾。新數替換第一個大於等於它的結尾，讓未來更容易延長。","[3,1,2,5,4] 的 tails 最後是 [1,2,4]，長度 3。"],
["knapsack","0/1 背包","動態規劃","vector","dp[c] 是容量不超過 c 的最大收益。容量逆序更新，確保本輪讀到的是還沒使用現在這件物品的結果。","容量 5，物品 (2,3)、(3,4)，兩個都拿可得 7。"],
["prefix","二維前綴和","陣列與查詢","matrix","先累積每個左上角矩形的總和。求任一矩形時，扣掉上方和左方，再加回扣了兩次的左上交集。","在 [[1,2],[3,4]] 查第二欄，總矩形 10 減第一欄 4，得到 6。"],
["compress","座標壓縮","陣列與查詢","vector","拷貝值、排序、去重，原值改成它在排序表的位置。相對順序和相等關係會保留。","[40,10,40,20] 變成 [2,0,2,1]。"],
["hull","Monotone Chain 凸包","計算幾何","vector","按 x 再按 y 排序，分別建下半與上半邊界。新點使末端三點右轉或共線時，移除中間點。","正方形四個角加中心點，中心點在掃描時被移除，最後只保留四個角。"],
["submask","枚舉位元子集合","位元運算","bit","(sub-1) 讓最右方的 1 消失並把右側都變成 1，再用 AND 去掉原集合沒有的位元。","mask=101，枚舉得到 101、100、001、000。"],
["rollback","Rollback DSU","資料結構","vector","合併時只改一個父指標及一個大小，記下變動就能撤銷。find 不壓縮路徑，否則撤銷時要還原額外的父指標。","先合併 0→1 再記下 snap，合併 1→2 後還原 snap，0 和 1 仍連通但 2 分離。"],
["sparse","Sparse Table 區間最小值","資料結構","matrix","預算長度 1、2、4、8 的區間最小值。查詢時用靠左與靠右的兩個區塊覆蓋整段，重疊元素不會改變最小值。","[6,4,1,3,2] 查 [1,5) 最小值為 1。陣列需固定不變。"],
["manacher","Manacher 最長回文","字串","string","維護目前最右回文的中心和邊界。區間內的位置先從鏡像位置取已知半徑，再檢查兩側是否還能擴張。","abacaba 的中心是 c，奇數半徑為 4，對應長度 7。"],
["kruskal","Kruskal 最小生成樹","圖論","vector","按邊權遞增處理。只有連接不同連通塊的邊才加入，這樣不會造出環。每次挑目前最便宜的跨連通塊邊。","三角形邊權 1、2、5 時，先選 1 和 2，最後一邊會造環而被跳過。"],
["inverse","擴展歐幾里得與模反元素","數論","math","除了 gcd，也追蹤 x、y 使 ax+by=gcd。若 gcd(a,m)=1，就有 ax≡1 (mod m)，所以 x 是反元素。","3×5≡1 (mod 7)，因此 3 在模 7 下的反元素為 5。"],
["monotonic","單調堆疊 下一個更大值","陣列與查詢","vector","堆疊儲存仍在等答案的索引，對應值維持遞減。每個新值都能結束比它小的那些等待項目。","[3,1,2,4] 的下一個更大值索引是 [3,2,3,-1]。"],
];

const snippets: Record<string, [string,string,string]> = {
bfs: ["#include <queue>\n#include <vector>", `std::vector<int> bfs(const std::vector<std::vector<int>>& g, int s) {
    std::vector<int> d(g.size(), -1); std::queue<int> q;
    d[s] = 0; q.push(s);
    while (!q.empty()) {
        int u = q.front(); q.pop();
        for (int v : g[u]) if (d[v] == -1) { d[v] = d[u]+1; q.push(v); }
    }
    return d;
}`, "O(V+E)。g 是 0-based 鄰接串列，-1 表示不可達。"],
topo: ["#include <queue>\n#include <vector>", `std::vector<int> topo(const std::vector<std::vector<int>>& g) {
    std::vector<int> deg(g.size()), order; std::queue<int> q;
    for (auto& row : g) for (int v : row) ++deg[v];
    for (int i=0; i<(int)g.size(); ++i) if (!deg[i]) q.push(i);
    while (!q.empty()) {
        int u = q.front(); q.pop(); order.push_back(u);
        for (int v : g[u]) if (!--deg[v]) q.push(v);
    }
    return order;
}`, "O(V+E)。呼叫者用 order.size()==g.size() 判斷是否有完整排序。"],
floyd: ["#include <algorithm>\n#include <vector>", `void floyd(std::vector<std::vector<long long>>& d, long long inf = 1LL<<60) {
    int n = d.size();
    for (int k=0;k<n;++k) for (int i=0;i<n;++i) for (int j=0;j<n;++j)
        if (d[i][k] != inf && d[k][j] != inf)
            d[i][j] = std::min(d[i][j], d[i][k]+d[k][j]);
}`, "O(n³)。初始化 d[i][i]=0，無邊為 inf，平行邊取最小。距離必須遠小於 inf；負環使最短路無定義。"],
gcd: ["", `unsigned long long gcd(unsigned long long a, unsigned long long b) {
    while (b) { auto r = a % b; a = b; b = r; }
    return a;
}`, "O(log min(a,b))。此版使用非負整數，gcd(0,0) 回傳 0。"],
spf: ["#include <vector>", `std::vector<int> smallest_factor(int n) {
    std::vector<int> spf(n+1);
    for (int p=2;p<=n;++p) if (!spf[p]) {
        spf[p]=p;
        for (long long x=1LL*p*p;x<=n;x+=p) if (!spf[x]) spf[x]=p;
    }
    return spf;
}`, "O(n log log n) 預處理，分解 2≤x≤n 時反覆取 spf[x] 並整除，直到 1。"],
z: ["#include <string>\n#include <vector>\n#include <algorithm>", `std::vector<int> z_function(const std::string& s) {
    int n=s.size(); std::vector<int> z(n);
    for (int i=1,l=0,r=0;i<n;++i) {
        if (i<r) z[i]=std::min(r-i,z[i-l]);
        while (i+z[i]<n && s[z[i]]==s[i+z[i]]) ++z[i];
        if (i+z[i]>r) { l=i; r=i+z[i]; }
    }
    return z;
}`, "O(n)。找模式時可串起 pattern + 分隔符 + text，分隔符不能出現在輸入。"],
lis: ["#include <algorithm>\n#include <vector>", `int lis(const std::vector<int>& a) {
    std::vector<int> tails;
    for (int x : a) {
        auto it = std::lower_bound(tails.begin(), tails.end(), x);
        if (it == tails.end()) tails.push_back(x); else *it = x;
    }
    return tails.size();
}`, "O(n log n)。求非嚴格遞增時改用 upper_bound。tails 本身未必是一條原序列中的子序列。"],
knapsack: ["#include <algorithm>\n#include <utility>\n#include <vector>", `long long knapsack(int capacity, const std::vector<std::pair<int,long long>>& items) {
    std::vector<long long> dp(capacity+1);
    for (auto [weight,value] : items)
        for (int c=capacity;c>=weight;--c) dp[c]=std::max(dp[c],dp[c-weight]+value);
    return dp[capacity];
}`, "O(nC) 時間與 O(C) 空間。重量與容量非負；如果要求恰好裝滿，需用不可達的初始值。"],
prefix: ["#include <vector>", `struct Prefix2D {
    std::vector<std::vector<long long>> sum;
    explicit Prefix2D(const std::vector<std::vector<int>>& a)
      : sum(a.size()+1, std::vector<long long>((a.empty()?0:a[0].size())+1)) {
        for (int i=0;i<(int)a.size();++i) for(int j=0;j<(int)a[i].size();++j)
            sum[i+1][j+1]=a[i][j]+sum[i][j+1]+sum[i+1][j]-sum[i][j];
    }
    long long query(int r1,int c1,int r2,int c2) const {
        return sum[r2][c2]-sum[r1][c2]-sum[r2][c1]+sum[r1][c1];
    }
};`, "建立 O(RC)，查詢 O(1)。矩陣各列等長，查詢採 0-based 半開區間。"],
compress: ["#include <algorithm>\n#include <vector>", `std::vector<int> compress(const std::vector<int>& a) {
    auto values=a;
    std::sort(values.begin(),values.end());
    values.erase(std::unique(values.begin(),values.end()),values.end());
    std::vector<int> ranks;
    for (int x:a) ranks.push_back(std::lower_bound(values.begin(),values.end(),x)-values.begin());
    return ranks;
}`, "O(n log n)。壓縮後的差值沒有原來的距離意義，也不保留整數間的空隙大小。"],
hull: ["#include <algorithm>\n#include <utility>\n#include <vector>", `using Point=std::pair<long long,long long>;
long long cross(Point a,Point b,Point c) {
    return (b.first-a.first)*(c.second-a.second)-(b.second-a.second)*(c.first-a.first);
}
std::vector<Point> hull(std::vector<Point> a) {
    std::sort(a.begin(),a.end()); a.erase(std::unique(a.begin(),a.end()),a.end());
    if (a.size()<2) return a;
    std::vector<Point> lower,upper;
    auto push=[](auto& h,Point p) {
        while (h.size()>1 && cross(h[h.size()-2],h.back(),p)<=0) h.pop_back();
        h.push_back(p);
    };
    for (auto p:a) push(lower,p);
    for(auto it=a.rbegin();it!=a.rend();++it) push(upper,*it);
    lower.pop_back(); upper.pop_back();
    lower.insert(lower.end(),upper.begin(),upper.end());
    return lower;
}`, "O(n log n)。此版移除邊界上的中間共線點。座標限制在 ±10⁹ 內以避免 long long 溢位。"],
submask: ["#include <vector>", `std::vector<unsigned> submasks(unsigned mask) {
    std::vector<unsigned> result;
    for (unsigned sub=mask;;sub=(sub-1)&mask) {
        result.push_back(sub);
        if (!sub) break;
    }
    return result;
}`, "O(2^k)，k 是 mask 的 1 數量。零要特別跳出，否則無號減法會回繞。"],
rollback: ["#include <numeric>\n#include <utility>\n#include <vector>", `struct RollbackDSU {
    struct Change { int child, root, size; };
    std::vector<int> parent,size;
    std::vector<Change> history;
    explicit RollbackDSU(int n):parent(n),size(n,1) { std::iota(parent.begin(),parent.end(),0); }
    int find(int x) const { while (x!=parent[x]) x=parent[x]; return x; }
    int snapshot() const { return history.size(); }
    void unite(int a,int b) {
        a=find(a); b=find(b);
        if (a==b) return;
        if (size[a]<size[b]) std::swap(a,b);
        history.push_back({b,a,size[a]}); parent[b]=a; size[a]+=size[b];
    }
    void rollback(int snap) {
        while (snapshot()>snap) {
            auto [b,a,s]=history.back(); history.pop_back();
            parent[b]=b; size[a]=s;
        }
    }
};`, "find 和 unite 為 O(log n)，每撤銷一筆合併 O(1)。snap 必須是目前歷史的有效前綴。"],
sparse: ["#include <algorithm>\n#include <bit>\n#include <vector>", `struct SparseMin {
    std::vector<std::vector<int>> table;
    explicit SparseMin(const std::vector<int>& a):table{a} {
        for (int len=2;len<=(int)a.size();len*=2) {
            std::vector<int> row(a.size()-len+1);
            for (int i=0;i<(int)row.size();++i) row[i]=std::min(table.back()[i],table.back()[i+len/2]);
            table.push_back(row);
        }
    }
    int query(int l,int r) const {
        int k=std::bit_width(static_cast<unsigned>(r-l))-1;
        return std::min(table[k][l],table[k][r-(1<<k)]);
    }
};`, "預處理 O(n log n)，查詢 O(1)。C++20；[l,r) 必須非空。求總和不可直接使用兩個重疊區塊。"],
manacher: ["#include <algorithm>\n#include <string>\n#include <vector>", `std::vector<int> odd_palindromes(const std::string& s) {
    int n=s.size(); std::vector<int> radius(n);
    for (int i=0,l=0,r=-1;i<n;++i) {
        int k=i>r?1:std::min(radius[l+r-i],r-i+1);
        while (i-k>=0 && i+k<n && s[i-k]==s[i+k]) ++k;
        radius[i]=k;
        if (i+k-1>r) { l=i-k+1; r=i+k-1; }
    }
    return radius;
}`, "O(n)。這個函式算奇數長度，長度為 2r−1。要同時處理偶數，可先在每個字元間插入固定分隔符，再算奇數半徑。"],
kruskal: ["#include <algorithm>\n#include <numeric>\n#include <tuple>\n#include <vector>", `std::pair<long long,int> kruskal(int n,std::vector<std::tuple<long long,int,int>> edges) {
    std::vector<int> p(n),size(n,1); std::iota(p.begin(),p.end(),0);
    auto find=[&](int x) { while (x!=p[x]) x=p[x]=p[p[x]]; return x; };
    std::sort(edges.begin(),edges.end());
    long long cost=0; int components=n;
    for (auto [w,u,v]:edges) {
        u=find(u); v=find(v); if (u==v) continue;
        if (size[u]<size[v]) std::swap(u,v);
        p[v]=u; size[u]+=size[v]; cost+=w; --components;
    }
    return {cost,components};
}`, "O(E log E + V)。輸入 tuple 順序為權重、起點、終點。若 components > 1，得到的是最小生成森林。"],
inverse: ["#include <optional>", `long long ext_gcd(long long a,long long b,long long& x,long long& y) {
    if (!b) { x=1; y=0; return a; }
    long long u,v; auto g=ext_gcd(b,a%b,u,v);
    x=v; y=u-(a/b)*v; return g;
}
std::optional<int> inverse(long long a,int mod) {
    if (mod<=1) return {};
    a=(a%mod+mod)%mod;
    long long x,y;
    if (ext_gcd(a,mod,x,y)!=1) return {};
    return (x%mod+mod)%mod;
}`, "O(log mod)。mod 必須大於 1，a 和 mod 互質才存在反元素。"],
monotonic: ["#include <vector>", `std::vector<int> next_greater(const std::vector<int>& a) {
    std::vector<int> waiting,answer(a.size(),-1);
    for (int i=0;i<(int)a.size();++i) {
        while (!waiting.empty() && a[waiting.back()]<a[i]) {
            answer[waiting.back()]=i; waiting.pop_back();
        }
        waiting.push_back(i);
    }
    return answer;
}`, "O(n)。比較使用嚴格小於，相同值不會被彈出。-1 表示右方沒有更大的值。"],
};

for (const [id, title, category, , principle, example] of extra) {
  const [headers, code, limits] = snippets[id];
  add(id, title, category, headers + "\n" + code,
    ["## 原理", principle, "## 手推範例", example, "## 複雜度與使用條件", limits].join("\n\n"));
}
