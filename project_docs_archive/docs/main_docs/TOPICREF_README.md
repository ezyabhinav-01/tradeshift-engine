# #TopicRef — Knowledge Graph Link System

> A proprietary feature that turns `#hashtags` into interactive, Wikipedia-style deep-links connecting every concept in the TradeShift Academy into a navigable knowledge web.

![Status](https://img.shields.io/badge/Status-Live-brightgreen?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-React%20%2B%20FastAPI%20%2B%20PostgreSQL-blue?style=flat-square)
![Hierarchy](https://img.shields.io/badge/Scope-Track%20%7C%20Module%20%7C%20Chapter%20%7C%20Lesson-purple?style=flat-square)

---

## 🧠 Concept

Think **Twitter hashtags** meets **Wikipedia blue links** — purpose-built for a learning platform.

When a user reads a lesson or browses community comments, any `#tag` (e.g. `#risk-management`, `#vwap`, `#candlestick`) becomes a glowing, interactive portal. Hovering reveals a glassmorphic preview card with a summary, breadcrumb path, and a "Jump to Deep Dive" button. Clicking navigates directly to the linked content.

### Why It Matters
- **Retention** — Users stay longer "rabbit-holing" through interconnected content
- **Utility** — The platform becomes a professional reference tool, not just a course
- **Growth** — As `#tags` grow, TradeShift builds a searchable knowledge dictionary no competitor has

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN CMS                                │
│                                                                 │
│   Topic Manager Page ──► POST /admin/tags ──► topic_tags (DB)   │
│   TipTap Editor ──► topicTag JSON node                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    PostgreSQL      │
                    │   topic_tags       │
                    │   ┌────────────┐   │
                    │   │ id         │   │
                    │   │ tag_name   │   │
                    │   │ display    │   │
                    │   │ summary    │   │
                    │   │ target_type│   │
                    │   │ target_id  │   │
                    │   │ icon_emoji │   │
                    │   │ usage_count│   │
                    │   └────────────┘   │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      MAIN APPLICATION                           │
│                                                                 │
│   GET /api/learn/tags ──► useTopicTags (cached hook)            │
│                                                                 │
│   Lesson HTML:    span.topic-tag ──► useTopicPortalHydrator     │
│   Comment Text:   parseTextWithTags() ──► TopicTagInline        │
│                                          ┌──────────────────┐   │
│                                          │  Hover Preview    │   │
│                                          │  ┌──────────────┐ │   │
│                                          │  │ 📊 VWAP      │ │   │
│                                          │  │ Volume Wt... │ │   │
│                                          │  │ TA > Volume  │ │   │
│                                          │  │ [Deep Dive→] │ │   │
│                                          │  └──────────────┘ │   │
│                                          └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

### Database
| File | Description |
|:---|:---|
| `topic_tags` table | Stores all registered tags with polymorphic target linking |
| `backend/app/models.py` | `TopicTag` SQLAlchemy model |

### Admin Application (`tradeshift_admin/`)
| File | Description |
|:---|:---|
| `backend/routes/content.py` | CRUD + search endpoints under `/admin/tags` |
| `frontend/src/api.js` | API client methods for tag operations |
| `frontend/src/pages/TopicManager.jsx` | Full-page tag registry with create/edit modal |
| `frontend/src/App.jsx` | Route `/topics` + sidebar nav item "Topic Links" |

### Main Application (`tradeshift-engine/`)
| File | Description |
|:---|:---|
| `backend/app/routers/learn.py` | `GET /tags`, `GET /tags/{name}` (breadcrumb), `POST /tags/{id}/click`, `tiptap_to_html()` topicTag support |
| `frontend/src/hooks/useTopicTags.ts` | Singleton-cached React hook for tag resolution |
| `frontend/src/components/TopicPortal.tsx` | `TopicTagInline`, `parseTextWithTags()`, `useTopicPortalHydrator()` |
| `frontend/src/pages/SubModuleDetailPage.tsx` | Integration point — lessons + comments |

---

## 🏷️ Tag Format

| Pattern | Example | Usage |
|:---|:---|:---|
| Single word | `#candlestick`, `#vwap` | Common for specific terms |
| Multi-word (kebab-case) | `#risk-management`, `#bullish-divergence` | For compound concepts |

### Normalization Rules
- Input: `Risk Management` → Stored: `risk-management`
- Input: `#VWAP` → Stored: `vwap`
- Spaces → hyphens, all lowercase, alphanumeric + hyphens only

---

## 🔗 Linking Scope

Tags can link to **any level** in the learning hierarchy:

| Target Type | Navigation | Icon |
|:---|:---|:---:|
| **Track** | `/learn/track/{id}` | 🏛️ |
| **Module** | `/learn/module/{id}` | 📚 |
| **Chapter** | `/learn/chapter/{id}` | 📖 |
| **Lesson** | `/learn/chapter/{sub_module_id}` | 📄 |

---

## 🎨 Tag States

### ✅ Registered Tag
- **Appearance**: Indigo glow pill with icon emoji + subtle breathing animation
- **Hover**: Glassmorphic preview card with:
  - Tag icon + display name
  - Short summary (2-3 sentences)
  - Breadcrumb path (Track > Module > Chapter)
  - "Jump to Deep Dive →" button
- **Click**: Navigates to the target page + increments `usage_count`

### ❌ Unregistered Tag
- **Appearance**: Muted gray pill with `?` indicator
- **Hover**: "Tag not found" card explaining it's not registered
- **Click**: No navigation

---

## 🖥️ API Reference

### Admin Endpoints (Port 8001)

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/admin/tags` | List all tags with resolved target titles |
| `GET` | `/admin/tags/search?q=` | Search tags for autocomplete |
| `POST` | `/admin/tags` | Register a new tag |
| `PUT` | `/admin/tags/{id}` | Update a tag |
| `DELETE` | `/admin/tags/{id}` | Delete a tag |

### Main App Endpoints (Port 8000)

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/learn/tags` | All tags (lightweight, for client cache) |
| `GET` | `/api/learn/tags/{tag_name}` | Single tag with breadcrumb + nav URL |
| `POST` | `/api/learn/tags/{tag_id}/click` | Increment usage count (analytics) |

### Response: `GET /api/learn/tags/{tag_name}`
```json
{
  "tagName": "risk-management",
  "displayName": "Risk Management",
  "shortSummary": "The systematic process of identifying, assessing...",
  "targetType": "chapter",
  "targetId": "45",
  "targetTitle": "Understanding Risk Management",
  "breadcrumb": "Trading Fundamentals > Core Strategies > Risk Management",
  "navigateTo": "/learn/chapter/45",
  "iconEmoji": "🛡️"
}
```

---

## 📊 Database Schema

```sql
CREATE TABLE topic_tags (
    id          SERIAL PRIMARY KEY,
    tag_name    VARCHAR(100) UNIQUE NOT NULL,     -- 'risk-management'
    display_name VARCHAR(150) NOT NULL,           -- 'Risk Management'
    short_summary TEXT,                           -- Hover preview text
    target_type VARCHAR(20) NOT NULL DEFAULT 'chapter',
    target_id   INTEGER NOT NULL,                 -- FK to target entity
    icon_emoji  VARCHAR(10) DEFAULT '📘',
    usage_count INTEGER DEFAULT 0,                -- Click analytics
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_topic_tags_name_lower ON topic_tags (LOWER(tag_name));
```

---

## 🚀 How to Use

### 1. Register a Tag (Admin)
1. Navigate to **Topic Links** in the admin sidebar
2. Click **Register Tag**
3. Enter a display name (e.g., "Risk Management") — tag ID auto-generates as `#risk-management`
4. Write a 2-sentence hover summary
5. Select target type → pick the target from the hierarchy
6. Choose an icon emoji → Submit

### 2. Use in Lesson Content (Admin TipTap Editor)
The `tiptap_to_html()` converter recognizes `topicTag` nodes and renders them as:
```html
<span class="topic-tag" data-tag="risk-management" data-display="Risk Management">
  #Risk Management
</span>
```
The `useTopicPortalHydrator` hook on the client side then upgrades these spans with interactivity (hover glow, click navigation).

### 3. Use in Comments (Users)
Users simply type `#risk-management` in any comment.  
`parseTextWithTags()` automatically detects the pattern and renders it as a `<TopicTagInline />` component with full hover/click behavior.

---

## ⚙️ Technical Details

### Client-Side Caching
The `useTopicTags` hook implements a **singleton cache pattern**:
- Tags are fetched once and cached in a module-level variable
- Subsequent component mounts reuse the cache instantly
- `refreshTags()` invalidates the cache when tags change

### DOM Hydration
For lesson content rendered via `dangerouslySetInnerHTML`:
1. Backend `tiptap_to_html()` renders `topicTag` nodes as `<span class="topic-tag">`
2. `useTopicPortalHydrator` scans the DOM post-render
3. Upgrades each span with: emoji prefix, hover glow styles, click handlers

### Comment Parsing
For user-generated comment text:
1. `parseTextWithTags(text)` runs a regex: `/#([a-zA-Z0-9][-a-zA-Z0-9]*)/g`
2. Each match is replaced with a `<TopicTagInline>` React component
3. Both registered and unregistered tags are rendered (with different states)

---

## 📈 Analytics

Every tag click increments `usage_count` in the database via a fire-and-forget `POST` request. The Admin Topic Manager page displays click counts per tag, enabling content teams to identify the most-referenced concepts.

---

## 🔮 Future Enhancements

- **Auto-Suggest**: Scan all lesson titles and auto-suggest new tags to register
- **Tag Categories**: Group tags by domain (Technical Analysis, Fundamentals, Psychology)
- **Global Search Integration**: Surface tags in the `⌘K` search bar
- **Related Tags**: Show "See Also" tags in the hover card
- **User Tag Submissions**: Let users propose new tags from comments

---

*Built with ❤️ for the TradeShift Learning Platform*
