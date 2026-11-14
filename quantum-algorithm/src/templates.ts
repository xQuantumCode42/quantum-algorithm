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

add("pbds-ordered-set", "PBDS ordered_set 排名與第 k 小", "GNU PBDS", `
#include <functional>
#include <ext/pb_ds/assoc_container.hpp>
#include <ext/pb_ds/tree_policy.hpp>

using OrderedSet = __gnu_pbds::tree<
    int, __gnu_pbds::null_type, std::less<int>,
    __gnu_pbds::rb_tree_tag, __gnu_pbds::tree_order_statistics_node_update>;

void example_ordered_set() {
    OrderedSet s;
    s.insert(10);
    s.insert(30);
    s.insert(20);
    auto rank = s.order_of_key(20); // 1
    auto second = s.find_by_order(1); // points to 20
    if (second != s.end()) s.erase(*second);
    (void)rank;
}
`, `
## 什麼時候用
需要一邊插入或刪除數值，一邊問「多少個值比 x 小？」或「第 k 小是誰？」時，用 ordered_set 可以直接查。普通 std::set 會排序，但從頭走到第 k 個需要逐步移動迭代器。
## 為什麼查得快
每個樹節點記住子樹大小。找第 k 小時，先看左子樹有幾個元素。如果 k 比左邊數量小，就往左。如果剛好相等，當前節點就是答案。否則跳過左子樹和自己，再往右找。
## 手推
插入 10、30、20，排序後是 [10,20,30]。order_of_key(20) 回傳 1，因為只有 10 嚴格小於 20。order_of_key(25) 回傳 2，即使 25 沒有插入。find_by_order(0) 是最小值 10，find_by_order(3) 回傳 end()。
## 複雜度與限制
插入、刪除、排名、第 k 小都是 O(log n)，選位次從 0 開始。這份模板的鍵值不能重複。需要 GNU GCC / libstdc++ 提供的 PBDS，Apple 系統預設的 clang++ / libc++ 編譯不了。
`);

add("pbds-ordered-multiset", "PBDS ordered_multiset 重複值排名", "GNU PBDS", `
#include <functional>
#include <limits>
#include <utility>
#include <ext/pb_ds/assoc_container.hpp>
#include <ext/pb_ds/tree_policy.hpp>

struct OrderedMultiset {
    using Key = std::pair<int, long long>;
    using Tree = __gnu_pbds::tree<Key, __gnu_pbds::null_type,
        std::less<Key>, __gnu_pbds::rb_tree_tag,
        __gnu_pbds::tree_order_statistics_node_update>;
    Tree values;
    long long next_id = 0;

    void insert(int x) { values.insert({x, next_id++}); }
    bool erase_one(int x) {
        auto it = values.lower_bound({x, 0});
        if (it == values.end() || it->first != x) return false;
        Key key = *it;
        values.erase(key);
        return true;
    }
    auto count_less(int x) const { return values.order_of_key({x, 0}); }
    auto count_equal(int x) const {
        return values.order_of_key({x, std::numeric_limits<long long>::max()}) - count_less(x);
    }
    auto find_by_order(Tree::size_type k) const { return values.find_by_order(k); }
};
`, `
## 怎麼容納重複值
每次插入 x 時，把它和唯一的流水號組成 (x,id)。pair 先比 x，再比 id，所以所有相同的 x 排在同一段，卻仍然是不同的鍵。
## 手推
依序插入 7、7、3，樹的順序為 (3,2)、(7,0)、(7,1)。count_less(7) 是 1，count_equal(7) 是 2。erase_one(7) 從第一個 7 下手，留下另一個 7。find_by_order(1) 回傳迭代器，檢查和 values.end() 不同後用 it->first 取得原值。
## 複雜度與限制
每項常用操作 O(log n)。保持嚴格排序 std::less；less_equal 不符合 PBDS 樹的比較規則。需使用 GNU GCC / libstdc++。流水號必須保持唯一且小於 long long 最大值。
`);

add("pbds-hash", "PBDS gp_hash_table 雜湊表", "GNU PBDS", `
#include <ext/pb_ds/assoc_container.hpp>
using FastCount = __gnu_pbds::gp_hash_table<int, int>;

int frequency_example() {
    FastCount frequency;
    for (int x : {3, 4, 3}) ++frequency[x];
    auto it = frequency.find(3);
    return it == frequency.end() ? 0 : it->second;
}
`, `
## 什麼時候用
要計數或快速查鍵值，且不需要鍵值保持排序時，可以考慮 gp_hash_table。它把雜湊後的鍵放進表格；發生碰撞時，照探測規則找下一個可用位置。
## 手推
依序掃描 [3,4,3]，frequency[3] 第一次建立值 0 後加到 1，第二次遇到 3 加到 2。只想查鍵是否存在時，用 find，因為 operator[] 可能建立新鍵。
## 複雜度與限制
插入及查找通常平均 O(1)，碰撞嚴重時可能退化。重新配置表格後，不應繼續使用原本取得的迭代器。需要 GNU GCC / libstdc++。若要可攜的 C++ 標準函式庫，用 std::unordered_map。
`);

add("merge-sort","合併排序與逆序對","陣列與查詢",`
#include <algorithm>
#include <vector>
long long merge_sort(std::vector<int>& a) {
    std::vector<int> temp(a.size());
    auto sort = [&](auto&& self, int l, int r) -> long long {
        if (r-l < 2) return 0;
        int m=l+(r-l)/2;
        long long count=self(self,l,m)+self(self,m,r);
        int i=l,j=m,k=l;
        while(i<m && j<r) {
            if(a[i]<=a[j]) temp[k++]=a[i++];
            else { temp[k++]=a[j++]; count+=m-i; }
        }
        while(i<m) temp[k++]=a[i++];
        while(j<r) temp[k++]=a[j++];
        std::copy(temp.begin()+l,temp.begin()+r,a.begin()+l);
        return count;
    };
    return sort(sort,0,a.size());
}
`,`
## 原理
先把兩半各自排好。兩個指標比較兩邊尚未取出的最小元素。右半的值若比左半目前值小，它也比左半所有剩餘元素小，所以一次計入 m-i 個逆序對。
## 手推
[4,1,3,2] 先排成 [1,4] 和 [2,3]。取 2、3 時各與 4 構成逆序，加上兩半內原有的兩對，共 4 對。
## 使用條件
O(n log n) 時間，O(n) 額外空間。相等元素先取左側，因此排序穩定。
`);

add("heap-comparator","自訂 priority_queue 排序","C++ 工具",`
#include <queue>
#include <vector>
struct Job { int priority, arrival; };
struct ComesLater {
    bool operator()(const Job& a, const Job& b) const {
        if (a.priority != b.priority) return a.priority < b.priority;
        return a.arrival > b.arrival;
    }
};
using JobQueue = std::priority_queue<Job,std::vector<Job>,ComesLater>;
`,`
## 原理
比較器回傳 true 表示 a 應排在 b 後面。這裡優先級越大越早，優先級相同時到達較早的先。比較器必須嚴格排序，相同的工作互相比較都回傳 false。
## 手推
加入 (8,4)、(6,0)、(8,2)，取出順序為 (8,2)、(8,4)、(6,0)。
## 使用條件
top O(1)，push/pop O(log n)。用具名函式物件可讓編譯器看見比較器型別，也可用無 capture lambda。
`);

add("flat-edges","邊結構與前向星","圖論",`
#include <vector>
struct FlatGraph {
    struct Edge { int to, next; long long weight; };
    std::vector<int> head;
    std::vector<Edge> edges;
    explicit FlatGraph(int n):head(n,-1) {}
    void add(int from,int to,long long weight=1) {
        edges.push_back({to,head[from],weight});
        head[from]=static_cast<int>(edges.size())-1;
    }
};
`,`
## 原理
所有邊放在一個陣列。head[u] 是 u 的第一條邊；每條邊的 next 指到同一個起點的下一條邊。-1 是串列結尾。
## 使用方式
以 for(int i=g.head[u]; i!=-1; i=g.edges[i].next) 掃描出邊。add(0,1) 與 add(0,2) 後，0 的第一條邊指向 2，再指向 1。
## 成本
新增一條有向邊攤銷 O(1)，空間 O(V+E)。無向邊要各方向新增一次。
`);

add("kosaraju","Kosaraju 強連通分量","圖論",`
#include <vector>
std::vector<int> kosaraju(const std::vector<std::vector<int>>& g) {
    int n=g.size(); std::vector<std::vector<int>> reverse(n);
    for(int u=0;u<n;++u) for(int v:g[u]) reverse[v].push_back(u);
    std::vector<bool> seen(n);
    std::vector<int> order, comp(n,-1);
    auto finish=[&](auto&& self,int u)->void {
        seen[u]=true;
        for(int v:g[u]) if(!seen[v]) self(self,v);
        order.push_back(u);
    };
    auto mark=[&](auto&& self,int u,int c)->void {
        comp[u]=c;
        for(int v:reverse[u]) if(comp[v]<0) self(self,v,c);
    };
    for(int u=0;u<n;++u) if(!seen[u]) finish(finish,u);
    int count=0;
    for(auto it=order.rbegin();it!=order.rend();++it) if(comp[*it]<0) mark(mark,*it,count++);
    return comp;
}
`,`
## 原理
強連通是有向圖裡能互相抵達的一組點。第一次 DFS 把點按離開的順序記下。第二次在反向圖依離開時間由晚到早走，當前起點能抵達的未分組點恰好在同一組。
## 手推
0↔1、1→2。0、1 可以互相回到對方，2 無法回到它們，所以得到兩組。
## 成本
O(V+E) 時間與空間。深圖可能超過遞迴堆疊，需改迭代版。
`);

add("tarjan-2sat","Tarjan SCC 與 2-SAT","圖論",`
#include <algorithm>
#include <optional>
#include <vector>
std::vector<int> tarjan(const std::vector<std::vector<int>>& g) {
    int n=g.size(), time=0, count=0;
    std::vector<int> enter(n,-1), low(n), comp(n,-1), stack;
    auto dfs=[&](auto&& self,int u)->void {
        low[u]=enter[u]=time++; stack.push_back(u);
        for(int v:g[u]) {
            if(enter[v]<0) { self(self,v); low[u]=std::min(low[u],low[v]); }
            else if(comp[v]<0) low[u]=std::min(low[u],enter[v]);
        }
        if(low[u]!=enter[u]) return;
        while(true) {
            int v=stack.back(); stack.pop_back(); comp[v]=count;
            if(v==u) break;
        }
        ++count;
    };
    for(int u=0;u<n;++u) if(enter[u]<0) dfs(dfs,u);
    return comp;
}
struct TwoSat {
    std::vector<std::vector<int>> g;
    explicit TwoSat(int n):g(2*n) {}
    // 2*i represents x_i; 2*i+1 represents its negation.
    void clause(int a,int b) { g[a^1].push_back(b); g[b^1].push_back(a); }
    std::optional<std::vector<bool>> solve() const {
        auto c=tarjan(g); std::vector<bool> answer(g.size()/2);
        for(int i=0;i<(int)answer.size();++i) {
            if(c[2*i]==c[2*i+1]) return {};
            answer[i]=c[2*i]<c[2*i+1];
        }
        return answer;
    }
};
`,`
## 原理
Tarjan 邊走訪邊用堆疊保存尚未確定分組的點。low[u] 記錄 u 的子樹能回到的最早堆疊位置。當 low[u] 等於自己進入的時間，u 就是這組的根，可一次彈出整組。
## 如何解 2-SAT
(a 或 b) 等價於「非 a 推出 b」和「非 b 推出 a」。若某個變數和它的否定落在同組，任何賦值都互相矛盾。Tarjan 的組號按反拓撲順序產生，此版本把較早彈出的文字設為真。
## 使用方式與成本
clause(0,3) 表示 x0 或非 x1，clause(0,0) 強制 x0 為真。O(變數數量+子句數量)；遞迴深度同圖深度。
`);

add("spfa","SPFA 佇列鬆弛與負環","圖論",`
#include <optional>
#include <queue>
#include <utility>
#include <vector>
std::optional<std::vector<long long>>
spfa(const std::vector<std::vector<std::pair<int,int>>>& g,int s) {
    constexpr long long inf=1LL<<60;
    int n=g.size(); std::vector<long long> d(n,inf);
    std::vector<int> length(n); std::vector<bool> queued(n);
    std::queue<int> q; d[s]=0; q.push(s); queued[s]=true;
    while(!q.empty()) {
        int u=q.front(); q.pop(); queued[u]=false;
        for(auto [v,w]:g[u]) if(d[u]+w<d[v]) {
            d[v]=d[u]+w; length[v]=length[u]+1;
            if(length[v]>=n) return {};
            if(!queued[v]) { q.push(v); queued[v]=true; }
        }
    }
    return d;
}
`,`
## 原理
只有距離變小的點才可能改善鄰居，所以把它放進待處理佇列。每次鬆弛還記下這條更短路徑的邊數，達到 n 時代表經過可達負環。
## 手推
0→1 為 4、0→2 為 6、1→2 為 -3。先記錄 2 的距離為 6；處理 1 後得到 1。
## 限制
最壞 O(VE)，可處理負邊。空結果表示從 s 可達負環。無邊用 inf 表示；若要檢測任意負環，可加連到所有點的零權超級源。
`);

add("dfs-relax","DFS 鬆弛與負環偵測","圖論",`
#include <utility>
#include <vector>
bool has_negative_cycle_dfs(const std::vector<std::vector<std::pair<int,int>>>& g) {
    std::vector<long long> d(g.size(),0);
    std::vector<bool> active(g.size());
    auto relax=[&](auto&& self,int u)->bool {
        active[u]=true;
        for(auto [v,w]:g[u]) if(d[u]+w<d[v]) {
            if(active[v]) return true;
            d[v]=d[u]+w;
            if(self(self,v)) return true;
        }
        active[u]=false;
        return false;
    };
    for(int u=0;u<(int)g.size();++u) if(relax(relax,u)) return true;
    return false;
}
`,`
## 原理
把所有初始距離設成 0，相當於加了超級源。只沿會改善距離的邊遞迴。若改善又回到目前遞迴堆疊中的祖先，沿該段走完後代價比原來更小，代表負環。
## 手推
0→1 權重 -2，1→0 權重 1。從 0 出發後 d[1] = -2，接著能把堆疊中的 0 改善為 -1。
## 限制
此方法可能反覆走訪同一節點，最壞情況慢，深圖也會吃堆疊。需要穩定上界時用 Bellman–Ford。
`);

add("rolling-hash","多項式與雙模字串雜湊","字串",`
#include <array>
#include <string>
#include <vector>
struct RollingHash {
    using Hash=std::array<long long,2>;
    static constexpr Hash mod{1000000007,1000000009};
    static constexpr long long base=911382323;
    std::vector<Hash> h,p;
    explicit RollingHash(const std::string& s):h(s.size()+1),p(s.size()+1) {
        p[0]={1,1};
        for(int i=0;i<(int)s.size();++i) for(int j=0;j<2;++j) {
            h[i+1][j]=(h[i][j]*base+static_cast<unsigned char>(s[i])+1)%mod[j];
            p[i+1][j]=p[i][j]*base%mod[j];
        }
    }
    Hash range(int l,int r) const {
        Hash ans{};
        for(int j=0;j<2;++j)
            ans[j]=(h[r][j]-h[l][j]*p[r-l][j]%mod[j]+mod[j])%mod[j];
        return ans;
    }
};
`,`
## 原理
把字串當成以 base 為底的整數，加入一字相當於乘 base 再加字元。用兩個模數存其餘數。切出 [l,r) 時，扣掉多乘了 r-l 次的舊前綴。
## 使用方式
在 banana 中比較 range(1,3) 和 range(3,5)，兩段都是 an。比較前先確認長度相同。也可用 unsigned 64 位自然溢位當模數，但仍要考慮碰撞。
## 成本
預處理 O(n)，每次區間雜湊 O(1)。雙模減少碰撞，仍不能保證完全相等。
`);

add("integer-digits","二進位與十進位位數","數論",`
#include <bit>
#include <cstdint>
int binary_digits(std::uint64_t value) {
    return value ? std::bit_width(value) : 1;
}
int decimal_digits(std::uint64_t value) {
    int count=1;
    while(value>=10) { value/=10; ++count; }
    return count;
}
`,`
## 原理
二進位位數是最高那個 1 的位置加一。十進位反覆除以 10，每一次相當於移除最右邊的一位。避免用浮點 log 在 10 的冪附近判錯。
## 手推
1000 除以 10 三次變 1，因此有 4 位。二進位 101 有 3 位。通常把 0 算一位。
## 成本
binary_digits 使用 C++20 bit_width。decimal_digits O(log10 n)，此版本接受無號整數。
`);

add("ext-gcd","擴展歐幾里得與線性丟番圖方程","數論",`
#include <optional>
#include <tuple>
std::tuple<long long,long long,long long> bezout(long long a,long long b) {
    if(!b) return {a,1,0};
    auto [g,x,y]=bezout(b,a%b);
    return {g,y,x-(a/b)*y};
}
std::optional<std::pair<long long,long long>> solve_ax_by(long long a,long long b,long long c) {
    auto [g,x,y]=bezout(a,b);
    if(!g) return c ? std::nullopt : std::optional{std::pair{0LL,0LL}};
    if(c%g) return {};
    return std::pair{x*(c/g),y*(c/g)};
}
`,`
## 原理
先用歐幾里得求 gcd，再倒回每層把餘數改寫成 a−⌊a/b⌋b，得到係數 x、y 使 ax+by=gcd。當 gcd 整除 c，兩個係數同乘 c/gcd 就得到一組解。
## 手推
6x+9y=15 有 x=-5、y=5 這組解。6x+9y=4 無解，因為左側必定是 3 的倍數。
## 成本
O(log max(a,b))。傳非負 a、b；係數和乘積都必須能放進 long long。
`);

add("matrix-power","矩陣乘法與矩陣快速冪","數論",`
#include <cstdint>
#include <vector>
using Matrix=std::vector<std::vector<long long>>;
Matrix multiply(const Matrix& a,const Matrix& b,int mod) {
    Matrix c(a.size(),std::vector<long long>(b.front().size()));
    for(int i=0;i<(int)a.size();++i) for(int k=0;k<(int)b.size();++k)
        for(int j=0;j<(int)b[k].size();++j)
            c[i][j]=(c[i][j]+a[i][k]*b[k][j])%mod;
    return c;
}
Matrix matrix_pow(Matrix a,std::uint64_t exp,int mod) {
    Matrix ans(a.size(),std::vector<long long>(a.size()));
    for(int i=0;i<(int)a.size();++i) ans[i][i]=1%mod;
    while(exp) {
        if(exp&1) ans=multiply(ans,a,mod);
        a=multiply(a,a,mod); exp>>=1;
    }
    return ans;
}
`,`
## 原理
當下一步狀態是目前狀態的線性組合，可以用矩陣乘上狀態向量。要走很多步，就把轉移矩陣快速平方。
## 手推
Fibonacci 的轉移 [[1,1],[1,0]] 乘 [F(n),F(n-1)] 得到 [F(n+1),F(n)]。矩陣二次方代表一次走兩步。
## 成本
方陣 k×k，O(k³ log exp)。mod 要為正，矩陣非空且維度相容，元素先化成 [0,mod)。
`);

add("lucas","Lucas 定理 二項式係數","數論",`
#include <vector>
struct Lucas {
    int p; std::vector<long long> fact, invfact;
    long long power(long long a,int e) const {
        long long r=1;
        for(;e;e>>=1,a=a*a%p) if(e&1) r=r*a%p;
        return r;
    }
    explicit Lucas(int prime):p(prime),fact(p,1),invfact(p,1) {
        for(int i=1;i<p;++i) fact[i]=fact[i-1]*i%p;
        invfact[p-1]=power(fact[p-1],p-2);
        for(int i=p-1;i>0;--i) invfact[i-1]=invfact[i]*i%p;
    }
    long long choose(unsigned long long n,unsigned long long k) const {
        long long ans=1;
        while(n || k) {
            int a=n%p,b=k%p;
            if(b>a) return 0;
            ans=ans*fact[a]%p*invfact[b]%p*invfact[a-b]%p;
            n/=p; k/=p;
        }
        return ans;
    }
};
`,`
## 原理
要算 C(n,k) mod p 且 n 很大時，把 n 和 k 寫成 p 進位。Lucas 定理說答案等於各位 C(ni,ki) 的乘積。原因是模質數 p 下 (1+x)^p ≡ 1+x^p，中間係數都可被 p 整除。
## 手推
p=5，n=7→12，k=2→02，所以 C(7,2) mod 5 = C(1,0)×C(2,2)=1。
## 成本
預處理 O(p)，查詢 O(log_p n)。p 必須是質數且能配置 p 格空間。
`);

add("factorization","試除法 質因數分解","數論",`
#include <utility>
#include <vector>
std::vector<std::pair<long long,int>> factorize(long long n) {
    std::vector<std::pair<long long,int>> result;
    for(long long p=2;p<=n/p;p+=(p==2?1:2)) if(n%p==0) {
        int count=0;
        do { n/=p; ++count; } while(n%p==0);
        result.push_back({p,count});
    }
    if(n>1) result.push_back({n,1});
    return result;
}
`,`
## 原理
從小到大測試能否整除。找到因數就除到不能再除。剩餘值若大於 1，而且所有不超過平方根的因數都驗過，它本身就是質數。
## 手推
84 除兩次 2、一次 3，剩下 7，得到 2²×3×7。1 回傳空因數表。
## 成本
最壞 O(√n)。適合少量不太大的正整數。大量小查詢可用 SPF。
`);

add("lazy-segment","懶標記線段樹 區間加與區間和","資料結構",`
#include <vector>
struct LazySum {
    int n; std::vector<long long> sum,pending;
    explicit LazySum(int size):n(size),sum(4*n),pending(4*n) {}
    void apply(int p,int length,long long delta) {
        sum[p]+=length*delta; pending[p]+=delta;
    }
    void push(int p,int l,int r) {
        int m=l+(r-l)/2;
        apply(2*p,m-l,pending[p]); apply(2*p+1,r-m,pending[p]);
        pending[p]=0;
    }
    long long visit(int p,int l,int r,int a,int b,long long delta,bool update) {
        if(r<=a || b<=l) return 0;
        if(a<=l && r<=b) {
            if(update) apply(p,r-l,delta);
            return sum[p];
        }
        push(p,l,r);
        int m=l+(r-l)/2;
        auto left=visit(2*p,l,m,a,b,delta,update);
        auto right=visit(2*p+1,m,r,a,b,delta,update);
        sum[p]=sum[2*p]+sum[2*p+1];
        return left+right;
    }
    void add(int l,int r,long long value) { if(l<r) visit(1,0,n,l,r,value,true); }
    long long query(int l,int r) { return l<r ? visit(1,0,n,l,r,0,false) : 0; }
};
`,`
## 原理
整段加 v 時，該段總和直接加上長度乘 v，並把 v 累加在 pending。等到未來操作只覆蓋一部分，才用 push 把尚未處理的增量傳給兩個孩子。
## 手推
四個零，對 [0,4) 加 3 後，根總和為 12。查 [1,3) 才逐層把 3 傳下去，得到 6。
## 成本
O(log n) 每次，O(n) 空間，使用 0-based 半開區間。這份標記的意思是「加上」，若要支援指定某值，標記合併規則也要改。
`);

add("dynamic-segment","動態開點線段樹","資料結構",`
#include <memory>
struct DynamicSum {
    struct Node { long long sum=0; std::unique_ptr<Node> left,right; };
    std::unique_ptr<Node> root;
    static void add(std::unique_ptr<Node>& p,long long l,long long r,long long at,long long delta) {
        if(!p) p=std::make_unique<Node>();
        p->sum+=delta;
        if(r-l==1) return;
        auto m=l+(r-l)/2;
        if(at<m) add(p->left,l,m,at,delta); else add(p->right,m,r,at,delta);
    }
    static long long query(const Node* p,long long l,long long r,long long a,long long b) {
        if(!p || b<=l || r<=a) return 0;
        if(a<=l && r<=b) return p->sum;
        auto m=l+(r-l)/2;
        return query(p->left.get(),l,m,a,b)+query(p->right.get(),m,r,a,b);
    }
};
`,`
## 原理
座標可能到十億，但只更新幾個座標。把樹視為一開始全為零，某一分支首次更新才配置；空指標代表整段都是零。
## 手推
在 [0,10⁹) 對位置 8 加 5，只建立從根走到 8 的節點。查 [9,12) 時，不需要為沒用過的分支配置記憶體。
## 成本
O(log U) 每次，q 次更新使用 O(q log U) 空間。U 是值域寬度，傳入的座標必須在根的半開區間內。
`);

add("bipartite-matching","匈牙利增廣路 二分圖最大匹配","圖論",`
#include <algorithm>
#include <vector>
std::vector<int> match_right(const std::vector<std::vector<int>>& adj,int rights) {
    std::vector<int> owner(rights,-1), seen(rights,-1);
    auto augment=[&](auto&& self,int left,int stamp)->bool {
        for(int r:adj[left]) if(seen[r]!=stamp) {
            seen[r]=stamp;
            if(owner[r]<0 || self(self,owner[r],stamp)) { owner[r]=left; return true; }
        }
        return false;
    };
    for(int l=0;l<(int)adj.size();++l) augment(augment,l,l);
    return owner;
}
`,`
## 原理
如果一位左側成員想配已被占用的右點，就試著替舊主人找另一個位置。沿著「未用邊、已配對邊」交替走到空位，把路上的配對翻轉，總配對數增加一。
## 手推
A 可選 1 或 2，B 只可選 1。若 A 先配 1，B 可以要求 A 改配 2，再取得 1。
## 成本
最壞 O(L·E)，回傳每個右點的左側主人或 -1。此版本求最大數量，若題目每個配對有成本，需要加權指派算法。
`);

add("hungarian-cost","Hungarian 加權指派","圖論",`
#include <limits>
#include <utility>
#include <vector>
std::pair<long long,std::vector<int>> assign_min(const std::vector<std::vector<int>>& costs) {
    int n=costs.size(), m=n?costs.front().size():0;
    constexpr long long inf=std::numeric_limits<long long>::max()/4;
    std::vector<long long> u(n+1),v(m+1);
    std::vector<int> p(m+1),prev(m+1);
    for(int i=1;i<=n;++i) {
        p[0]=i; int j=0;
        std::vector<long long> slack(m+1,inf);
        std::vector<bool> used(m+1);
        do {
            used[j]=true; int row=p[j], next=0; long long delta=inf;
            for(int k=1;k<=m;++k) if(!used[k]) {
                long long reduced=costs[row-1][k-1]-u[row]-v[k];
                if(reduced<slack[k]) { slack[k]=reduced; prev[k]=j; }
                if(slack[k]<delta) { delta=slack[k]; next=k; }
            }
            for(int k=0;k<=m;++k) {
                if(used[k]) { u[p[k]]+=delta; v[k]-=delta; }
                else slack[k]-=delta;
            }
            j=next;
        } while(p[j]);
        while(j) { p[j]=p[prev[j]]; j=prev[j]; }
    }
    std::vector<int> picked(n,-1);
    for(int j=1;j<=m;++j) if(p[j]) picked[p[j]-1]=j-1;
    return {-v[0],picked};
}
`,`
## 原理
每列與每欄各有一個勢能。邊的成本扣除兩端勢能後叫縮減成本。先沿縮減成本零的邊找增廣路；走不通就用最小的 slack 更新勢能，讓下一條可走的邊成為零。
## 手推
成本為 [[4,1],[2,3]] 時，第一人選第二欄、第二人選第一欄，合計 3，比對角線的 7 少。
## 成本
O(n²m)，必須 n≤m，且成本矩陣每列等長。回傳最小成本與每列的 0-based 欄位。
`);

add("lca","二元提升 LCA 最近共同祖先","樹論",`
#include <bit>
#include <queue>
#include <vector>
struct Lca {
    std::vector<int> depth;
    std::vector<std::vector<int>> up;
    Lca(const std::vector<std::vector<int>>& tree,int root)
      :depth(tree.size(),-1),up(std::bit_width(tree.size()),std::vector<int>(tree.size(),root)) {
        std::queue<int> q; q.push(root); depth[root]=0;
        while(!q.empty()) {
            int u=q.front(); q.pop();
            for(int v:tree[u]) if(depth[v]<0) {
                depth[v]=depth[u]+1; up[0][v]=u; q.push(v);
            }
        }
        for(int k=1;k<(int)up.size();++k) for(int u=0;u<(int)depth.size();++u)
            up[k][u]=up[k-1][up[k-1][u]];
    }
    int query(int a,int b) const {
        if(depth[a]<depth[b]) return query(b,a);
        unsigned diff=depth[a]-depth[b];
        for(int k=0;diff;++k,diff>>=1) if(diff&1) a=up[k][a];
        if(a==b) return a;
        for(int k=(int)up.size()-1;k>=0;--k) if(up[k][a]!=up[k][b]) {
            a=up[k][a]; b=up[k][b];
        }
        return up[0][a];
    }
};
`,`
## 原理
up[k][x] 是往上跳 2^k 的祖先，可用兩次較小的跳躍算出。查詢時先把較深點拉到同一層，再由大到小嘗試同時跳，使兩點維持在不同分支，最後它們的父節點相同。
## 手推
0 是根，0 的孩子 1 和 2，1 的孩子 3。查 (3,2) 時，3 先升到 1，最後兩者共同父親為 0。
## 成本
建立 O(n log n)，查詢 O(log n)。兩個點都必須在同一棵有根樹。
`);

add("centroid","樹重心分解","樹論",`
#include <vector>
struct CentroidTree {
    const std::vector<std::vector<int>>& g;
    std::vector<int> size,parent;
    std::vector<bool> removed;
    explicit CentroidTree(const std::vector<std::vector<int>>& graph)
      :g(graph),size(g.size()),parent(g.size(),-1),removed(g.size()) {
        if(!g.empty()) build(0,-1);
    }
    int measure(int u,int p) {
        size[u]=1;
        for(int v:g[u]) if(v!=p && !removed[v]) size[u]+=measure(v,u);
        return size[u];
    }
    int locate(int u,int p,int half) {
        for(int v:g[u]) if(v!=p && !removed[v] && size[v]>half) return locate(v,u,half);
        return u;
    }
    void build(int start,int previous) {
        int half=measure(start,-1)/2;
        int c=locate(start,-1,half);
        removed[c]=true; parent[c]=previous;
        for(int v:g[c]) if(!removed[v]) build(v,c);
    }
};
`,`
## 原理
移除重心後，每個剩餘子樹都最多是原本一半。沿著超過一半的子樹走就能找到重心。每次移除一個重心，再對各塊重複，得到只有 O(log n) 層的重心樹。
## 手推
1—2—3—4—5 先選 3，兩個大小 2 的部分各自再選自己的重心。
## 使用條件
建構 O(n log n)。適用樹上距離計數與最近標記點等分治問題。模板只建立重心父陣列，查詢需按題目另加距離資料；長鏈需留意遞迴堆疊。
`);

add("geometry-basic","向量、叉積與線段相交","計算幾何",`
#include <algorithm>
struct Point { long long x,y; };
long long cross(Point a,Point b,Point c) {
    return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}
bool on_segment(Point a,Point b,Point p) {
    return cross(a,b,p)==0 && std::min(a.x,b.x)<=p.x && p.x<=std::max(a.x,b.x)
        && std::min(a.y,b.y)<=p.y && p.y<=std::max(a.y,b.y);
}
int sign(long long x) { return (x>0)-(x<0); }
bool intersects(Point a,Point b,Point c,Point d) {
    int p=sign(cross(a,b,c)),q=sign(cross(a,b,d));
    int r=sign(cross(c,d,a)),s=sign(cross(c,d,b));
    if(p*q<0 && r*s<0) return true;
    return on_segment(a,b,c)||on_segment(a,b,d)||on_segment(c,d,a)||on_segment(c,d,b);
}
`,`
## 原理
叉積的正負告訴你 c 在有向直線 a→b 的哪一側。兩線段各自跨越對方所在的線時相交，也要額外處理端點接觸與共線重疊。
## 手推
(0,0) 到 (2,2) 與 (0,2) 到 (2,0) 互相跨過對方，在 (1,1) 相交。
## 成本
每次 O(1)，含端點接觸。整數座標限制 ±10⁹ 以避免 long long 溢位。
`);

add("circle-intersection","圓與圓交點","計算幾何",`
#include <algorithm>
#include <cmath>
#include <vector>
struct Point { double x,y; };
struct Circle { Point c; double r; };
std::vector<Point> circle_intersections(Circle a,Circle b) {
    constexpr double eps=1e-9;
    double x=b.c.x-a.c.x,y=b.c.y-a.c.y,d=std::hypot(x,y);
    if(d<eps || d>a.r+b.r+eps || d<std::abs(a.r-b.r)-eps) return {};
    double along=(a.r*a.r-b.r*b.r+d*d)/(2*d);
    double h=std::sqrt(std::max(0.0,a.r*a.r-along*along));
    Point base{a.c.x+x*along/d,a.c.y+y*along/d};
    if(h<eps) return {base};
    return {{base.x-y*h/d,base.y+x*h/d},{base.x+y*h/d,base.y-x*h/d}};
}
`,`
## 原理
兩圓交點共有一條弦，弦的中點在兩圓圓心連線上。把交點同時代入兩圓方程並相減，求出中點到圓心的距離 along，再用畢氏定理求弦的半長 h。
## 手推
半徑都為 1，圓心是 (0,0) 和 (2,0)，弦長變成 0，所以只有切點 (1,0)。
## 使用條件
O(1)。半徑非負。同心重合會有無限交點，呼叫端要另外辨識；函式只回傳有限個交點。
`);

add("circumcenter","三角形外心","計算幾何",`
#include <cmath>
#include <optional>
struct Point { double x,y; };
std::optional<Point> circumcenter(Point a,Point b,Point c) {
    double bx=b.x-a.x,by=b.y-a.y,cx=c.x-a.x,cy=c.y-a.y;
    double det=2*(bx*cy-by*cx);
    if(std::abs(det)<1e-12) return {};
    double b2=bx*bx+by*by,c2=cx*cx+cy*cy;
    return Point{a.x+(cy*b2-by*c2)/det,a.y+(bx*c2-cx*b2)/det};
}
`,`
## 原理
外心到三個頂點等距。所以它同時落在任兩邊的垂直平分線上。把座標原點移到 a，將距離平方相減，可得到兩條一次方程。
## 手推
三角形 (0,0)、(2,0)、(0,2) 的兩條垂直平分線為 x=1 和 y=1，交於 (1,1)。
## 成本
O(1)，三點共線時無唯一外心。浮點容差要依座標尺度調整。
`);

add("circle-union","多個圓的聯集面積","計算幾何",`
#include <algorithm>
#include <cmath>
#include <numbers>
#include <utility>
#include <vector>
struct Disk { double x,y,r; };
double disk_union(const std::vector<Disk>& disks) {
    constexpr double full=2*std::numbers::pi;
    constexpr double eps=1e-10;
    double twice=0;
    for(int i=0;i<(int)disks.size();++i) {
        auto [x,y,r]=disks[i];
        if(r<=0) continue;
        bool hidden=false;
        std::vector<std::pair<double,double>> spans;
        for(int j=0;j<(int)disks.size();++j) if(i!=j) {
            auto [u,v,s]=disks[j];
            double dx=u-x,dy=v-y,d=std::hypot(dx,dy);
            if(d+r<=s+eps && (d>eps || s>r+eps || j<i)) { hidden=true; break; }
            if(d<=eps || d>=r+s || d+s<=r) continue;
            double middle=std::atan2(dy,dx);
            double width=std::acos(std::clamp((r*r+d*d-s*s)/(2*r*d),-1.0,1.0));
            double lo=std::fmod(middle-width+full,full), hi=lo+2*width;
            spans.push_back({lo,std::min(full,hi)});
            if(hi>full) spans.push_back({0,hi-full});
        }
        if(hidden) continue;
        auto integrate=[&](double a,double b) {
            twice+=r*r*(b-a)+r*x*(std::sin(b)-std::sin(a))
                +r*y*(std::cos(a)-std::cos(b));
        };
        std::sort(spans.begin(),spans.end());
        double last=0;
        for(auto [a,b]:spans) {
            if(a>last) integrate(last,a);
            last=std::max(last,b);
        }
        if(last<full) integrate(last,full);
    }
    return twice/2;
}
`,`
## 原理
聯集的邊界只包含每個圓未被其他圓蓋住的弧。對每對相交的圓算出覆蓋角度，把跨 2π 的區間切開，排序後只積分沒有被覆蓋的空隙。沿邊界對 x dy − y dx 積分並除以 2，就得到面積。
## 手推
兩個單位圓完全分離時，兩條完整圓周各貢獻 π。完全重合時只保留一條圓周，答案 π。
## 成本
O(n² log n)，使用浮點數。尺度極端或近乎相切時，容差需要依題目精度調整。
`);

add("pair-hash","pair 鍵與自訂雜湊","C++ 工具",`
#include <cstddef>
#include <functional>
#include <unordered_map>
#include <utility>
struct PairHash {
    std::size_t operator()(const std::pair<int,int>& a) const {
        std::size_t x=std::hash<int>{}(a.first), y=std::hash<int>{}(a.second);
        return x ^ (y + 0x9e3779b9U + (x<<6) + (x>>2));
    }
};
using GridCounter=std::unordered_map<std::pair<int,int>,int,PairHash>;
`,`
## 原理
pair 沒有可直接依賴的標準雜湊。先雜湊各欄位，再混入不同位移。單純 XOR 會讓 (1,2) 和 (2,1) 永遠同值。
## 手推與用法
GridCounter cells; ++cells[{2,3}]; 能做稀疏格子的計數。查詢是否存在時用 find，避免建立空項。
## 成本
平均 O(1)。雜湊碰撞不會讓不同鍵變成同一筆，容器仍會比較相等。大量惡意碰撞時可能退化。
`);

add("salted-hash","加鹽 64 位雜湊與 PBDS","GNU PBDS",`
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <unordered_map>
#include <ext/pb_ds/assoc_container.hpp>
struct SaltHash {
    std::size_t operator()(std::uint64_t x) const {
        static const auto seed=static_cast<std::uint64_t>(
            std::chrono::steady_clock::now().time_since_epoch().count());
        x+=seed+0x9e3779b97f4a7c15ULL;
        x=(x^(x>>30))*0xbf58476d1ce4e5b9ULL;
        x=(x^(x>>27))*0x94d049bb133111ebULL;
        return x^(x>>31);
    }
};
using StandardCounter=std::unordered_map<std::uint64_t,int,SaltHash>;
using GnuCounter=__gnu_pbds::gp_hash_table<std::uint64_t,int,SaltHash>;
`,`
## 原理
把啟動時取得的種子加到鍵值，再用 SplitMix64 的混合步驟擴散位元。這會改變不同執行階段的碰撞分佈，讓固定輸入較難造成同一群碰撞。
## 使用方式
兩個 alias 都可用 ++counts[key] 計數，同一個程序內相同鍵仍會得到相同雜湊。
## 限制
不是密碼學雜湊。GnuCounter 需要 GNU libstdc++；只用 StandardCounter 可移除 PBDS 的 include 和 alias。
`);

add("fast-io","快速輸入與 C++ 競賽起手式","C++ 工具",`
#include <iostream>
#include <limits>

bool read_int(int& result) {
    std::istream& in=std::cin;
    if(!(in>>std::ws)) return false;
    bool negative=in.peek()=='-';
    if(negative || in.peek()=='+') in.get();
    long long limit=negative ? -static_cast<long long>(std::numeric_limits<int>::min()) : std::numeric_limits<int>::max();
    long long value=0;
    bool seen=false, overflow=false;
    while(in.peek()>='0' && in.peek()<='9') {
        int digit=in.get()-'0'; seen=true;
        if(value>(limit-digit)/10) overflow=true;
        else if(!overflow) value=10*value+digit;
    }
    if(!seen || overflow) return false;
    result=static_cast<int>(negative?-value:value);
    return true;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);
    int n;
    if(read_int(n)) std::cout << n << '\\n';
}
`,`
## 原理
關掉與 C I/O 的同步可減少額外工作。cin.tie(nullptr) 讓讀取時不必每次沖洗輸出。read_int 示範逐字元跳過空白、辨識符號及檢查整數溢位。
## 用法
多數題目直接 cin >> n 就夠快。要互動時，送出詢問後手動 flush。關閉同步後避免混用 scanf 和 cin。
## Pragma 與最佳化
優先用編譯選項 -O2 及適合的演算法。GCC 的 optimize 或 target pragma 並非標準 C++，不應硬指定評測機不保證的 SSE/AVX 指令。Ofast 也可能改變浮點語意。
`);

add("circle-overlap","圓交集面積與直線交點","計算幾何",`
#include <algorithm>
#include <cmath>
#include <numbers>
#include <vector>
struct Point { double x,y; };
double overlap(double r,double s,double d) {
    if(d>=r+s) return 0;
    if(d<=std::abs(r-s)) return std::numbers::pi*std::min(r,s)*std::min(r,s);
    auto segment=[](double radius,double offset) {
        double c=std::clamp(offset/radius,-1.0,1.0);
        return radius*radius*(std::acos(c)-c*std::sqrt(1-c*c));
    };
    double x=(d*d+r*r-s*s)/(2*d);
    return segment(r,x)+segment(s,d-x);
}
std::vector<Point> line_circle(Point a,Point b,Point center,double radius) {
    double dx=b.x-a.x,dy=b.y-a.y,len=std::hypot(dx,dy);
    if(!len) return {};
    dx/=len; dy/=len;
    double q=(center.x-a.x)*dx+(center.y-a.y)*dy;
    Point base{a.x+q*dx,a.y+q*dy};
    double distance=std::hypot(base.x-center.x,base.y-center.y);
    if(distance>radius+1e-10) return {};
    double h=std::sqrt(std::max(0.0,radius*radius-distance*distance));
    if(h<1e-10) return {base};
    return {{base.x-h*dx,base.y-h*dy},{base.x+h*dx,base.y+h*dy}};
}
`,`
## 原理
重疊的兩圓由共同弦切成兩塊弓形。每塊等於扇形面積減三角形面積；包含或相離時直接回傳小圓面積或 0。直線與圓求交時，先將圓心投影到直線，再依畢氏定理沿直線向兩側走。
## 手推
單位圓和 x 軸的投影點在原點，延伸距離 1，因此交點是 (-1,0) 和 (1,0)。
## 成本
每次 O(1)。line_circle 處理無限延伸直線；若題目給的是線段，再篩掉線段範圍外的點。
`);

add("disk-polygon","圓與多邊形交集面積","計算幾何",`
#include <algorithm>
#include <cmath>
#include <vector>
struct Point { double x,y; };
double disk_polygon(std::vector<Point> polygon,Point center,double radius) {
    if(polygon.size()<3 || radius<=0) return 0;
    auto dot=[](Point a,Point b){return a.x*b.x+a.y*b.y;};
    auto cross=[](Point a,Point b){return a.x*b.y-a.y*b.x;};
    for(auto& p:polygon) { p.x-=center.x; p.y-=center.y; }
    double sum=0,r2=radius*radius;
    for(int i=0;i<(int)polygon.size();++i) {
        Point a=polygon[i], b=polygon[(i+1)%polygon.size()], d{b.x-a.x,b.y-a.y};
        double A=dot(d,d),B=2*dot(a,d),C=dot(a,a)-r2;
        if(!A) continue;
        auto at=[&](double t){return Point{a.x+t*d.x,a.y+t*d.y};};
        std::vector<double> cut{0,1};
        double discriminant=B*B-4*A*C;
        if(discriminant>=0) for(double sign:{-1.,1.}) {
            double t=(-B+sign*std::sqrt(discriminant))/(2*A);
            if(0<t && t<1) cut.push_back(t);
        }
        std::sort(cut.begin(),cut.end());
        for(int j=1;j<(int)cut.size();++j) {
            Point u=at(cut[j-1]),v=at(cut[j]),mid=at((cut[j-1]+cut[j])/2);
            if(dot(mid,mid)<r2) sum+=cross(u,v);
            else sum+=r2*std::atan2(cross(u,v),dot(u,v));
        }
    }
    return std::abs(sum)/2;
}
`,`
## 原理
把圓心移到原點。每條多邊形邊和原點構成有向三角形。用圓和線段的交點切開邊，圓內部分累計三角形面積，圓外部分累計扇形面積。最後加總有向貢獻。
## 手推
大正方形完整包住單位圓時，四條邊都在圓外，各貢獻四分之一圓面積；結果為 π。
## 成本
O(n)。頂點要依邊界順序給出，適用簡單多邊形，需留意浮點誤差。
`);

add("range-min-add","懶標記線段樹 區間加與最小／最大值","資料結構",`
#include <algorithm>
#include <limits>
#include <vector>
struct RangeExtreme {
    using T=long long;
    struct Pair { T lo,hi; };
    int n; std::vector<Pair> tree; std::vector<T> lazy;
    explicit RangeExtreme(int size):n(size),tree(4*n,{0,0}),lazy(4*n) {}
    static Pair combine(Pair a,Pair b) { return {std::min(a.lo,b.lo),std::max(a.hi,b.hi)}; }
    void apply(int p,T d) { tree[p].lo+=d; tree[p].hi+=d; lazy[p]+=d; }
    void push(int p) { apply(2*p,lazy[p]); apply(2*p+1,lazy[p]); lazy[p]=0; }
    Pair walk(int p,int l,int r,int a,int b,T d,bool write) {
        if(r<=a || b<=l) return {std::numeric_limits<T>::max(),std::numeric_limits<T>::min()};
        if(a<=l && r<=b) {
            if(write) apply(p,d);
            return tree[p];
        }
        push(p);
        int m=l+(r-l)/2;
        Pair left=walk(2*p,l,m,a,b,d,write),right=walk(2*p+1,m,r,a,b,d,write);
        tree[p]=combine(tree[2*p],tree[2*p+1]);
        return combine(left,right);
    }
    void add(int l,int r,T delta) { if(l<r) walk(1,0,n,l,r,delta,true); }
    Pair query(int l,int r) { return walk(1,0,n,l,r,0,false); }
};
`,`
## 原理
整段一起加 d 時，最小值與最大值都只加一次 d。先留在 lazy，未來要切開區間時再傳給子節點。父節點最小、最大分別由兩個孩子合併。
## 手推
[0,0,0,0] 的 [0,2) 加 4、[1,3) 減 2，得到 [4,2,-2,0]。全區間的最小值 -2、最大值 4。
## 成本
O(log n) 每次，O(n) 空間。n>0，查詢在 [0,n) 且非空。與區間和不同，apply 不乘區間長度。
`);
