# SolarFlux Manager - Next.js App Router Architecture

## 📁 Project Structure

The application has been refactored to follow Next.js 14+ App Router best practices with proper separation of concerns and routing.

### Directory Structure

```
/workspaces/solarflux/
├── app/
│   ├── (dashboard)/          # Route group for authenticated pages
│   │   ├── layout.tsx        # Dashboard layout with Sidebar
│   │   ├── page.tsx          # Redirects to /clients
│   │   ├── loading.tsx       # Loading UI for dashboard
│   │   ├── error.tsx         # Error boundary for dashboard
│   │   ├── not-found.tsx     # 404 page
│   │   ├── clients/
│   │   │   └── page.tsx      # Client Registry page
│   │   ├── inventory/
│   │   │   └── page.tsx      # Inventory Management page
│   │   ├── quote-generator/
│   │   │   └── page.tsx      # Quote Generator page
│   │   ├── file-manager/
│   │   │   └── page.tsx      # File Manager page
│   │   └── settings/
│   │       └── page.tsx      # Settings page
│   ├── login/
│   │   └── page.tsx          # Login page
│   ├── api/
│   │   └── auth/             # Authentication API routes
│   │       ├── login/
│   │       ├── logout/
│   │       └── session/
│   ├── layout.tsx            # Root layout with providers
│   ├── page.tsx              # Root page (redirects to /clients)
│   ├── globals.css           # Global styles
│   └── loading.tsx           # Root loading UI
├── components/               # React components
│   ├── Sidebar.tsx           # Navigation sidebar
│   ├── Login.tsx             # Login form
│   ├── ClientRegistry.tsx    # Client management
│   ├── InventoryList.tsx     # Inventory list view
│   ├── InventoryForm.tsx     # Inventory form
│   ├── QuoteGenerator.tsx    # Quote generation
│   ├── FileManager.tsx       # File management
│   ├── Settings.tsx          # Settings panel
│   └── ...                   # Other components
├── contexts/                 # React Context providers
│   ├── AuthContext.tsx       # Authentication state
│   ├── DataContext.tsx       # Application data state
│   └── ConfirmDialogContext.tsx # Confirm dialog state
├── lib/                      # Utility functions
│   ├── auth.ts              # Authentication utilities
│   └── session.ts           # Session management
├── services/                 # Business logic services
│   ├── firebase.ts          # Firebase/Firestore integration
│   ├── storageService.ts    # Data storage service
│   └── ...                  # Other services
├── middleware.ts            # Next.js middleware for route protection
└── types.ts                 # TypeScript type definitions
```

## 🚀 How It Works

### Routing Architecture

The application uses Next.js **App Router** with:
- **Route Groups**: `(dashboard)` groups authenticated pages without affecting URLs
- **Nested Layouts**: Sidebar layout wraps all dashboard pages
- **File-based Routing**: Each folder represents a route segment

### State Management

#### 1. **AuthContext** (`contexts/AuthContext.tsx`)
Manages authentication state globally:
- `isAuthenticated`: Boolean authentication status
- `currentUser`: Current logged-in user data
- `authLoading`: Loading state during session check
- `login()`: Login function
- `logout()`: Logout function

#### 2. **DataContext** (`contexts/DataContext.tsx`)
Manages application data globally:
- `inventory`: All inventory items
- `clients`: All clients
- `savedQuotes`: All saved quotes
- `users`: All users
- `docTemplates`: Document templates
- `companyDocuments`: Company files
- Auto-subscribes to Firestore collections
- Handles real-time updates

#### 3. **ConfirmDialogContext** (`contexts/ConfirmDialogContext.tsx`)
Manages confirmation dialogs:
- `showConfirmDialog()`: Display confirmation
- `closeConfirmDialog()`: Close dialog

### Page Components

Each route page is a wrapper that:
1. Uses context hooks to get global state
2. Passes data to presentation components as props
3. Handles data mutations (add, update, delete)
4. Updates Firestore via `StorageService`

Example pattern:
```tsx
// app/(dashboard)/clients/page.tsx
function ClientsPage() {
  const { clients, inventory } = useData();
  const { currentUser } = useAuth();
  
  const handleAddClient = async (client) => {
    await StorageService.save('clients', [...clients, client]);
  };
  
  return (
    <ClientRegistry
      clients={clients}
      inventory={inventory}
      currentUser={currentUser}
      onAddClient={handleAddClient}
    />
  );
}
```

### Navigation Flow

```
User clicks sidebar item
    ↓
Sidebar calls onChangeView(view)
    ↓
Layout calls router.push('/path')
    ↓
Next.js navigates to new route
    ↓
Page component renders
    ↓
Component loads data from contexts
```

### Authentication Flow

```
1. App loads → Root layout wraps with AuthProvider
2. AuthProvider checks /api/auth/session
3. If authenticated → Sets user state
4. If not authenticated → User stays null
5. Login page redirects to /clients if authenticated
6. Dashboard layout checks auth and redirects to /login if needed
```

## 🔐 Protected Routes

All routes under `(dashboard)` are protected:
- Middleware checks authentication
- Unauthenticated users redirect to `/login`
- API routes return 401 if not authenticated

Public routes:
- `/login` - Login page
- `/api/auth/login` - Login API
- `/api/auth/session` - Session check API

## 📋 Available Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Redirect | Redirects to `/clients` |
| `/login` | Login | Authentication page |
| `/clients` | ClientRegistry | Manage clients and projects |
| `/inventory` | InventoryList | View and manage inventory |
| `/quote-generator` | QuoteGenerator | Generate quotes |
| `/file-manager` | FileManager | Manage company documents |
| `/settings` | Settings | User and template settings |

## 🛠️ Key Features

### 1. Server-Side Authentication
- Sessions stored in encrypted cookies (iron-session)
- Passwords hashed with bcrypt
- API routes protected by middleware

### 2. Real-Time Data Sync
- Firestore subscriptions in DataContext
- Auto-updates when data changes
- No manual polling needed

### 3. Optimized Loading
- Suspense boundaries for code splitting
- Loading states for each route
- Lazy loading for heavy components

### 4. Error Handling
- Error boundaries at route level
- Graceful error recovery
- User-friendly error messages

### 5. Type Safety
- Full TypeScript coverage
- Strict type checking
- Intellisense support

## 🔄 Data Flow

```
User Action (UI)
    ↓
Handler Function (Page Component)
    ↓
StorageService.save()
    ↓
Firestore Update
    ↓
Firestore Subscription (DataContext)
    ↓
State Update (Context)
    ↓
Component Re-render (All Subscribers)
```

## 📝 Development Guidelines

### Adding a New Route

1. Create folder under `app/(dashboard)/`
2. Add `page.tsx` with wrapper component
3. Connect to contexts using hooks
4. Update Sidebar with new navigation item

Example:
```tsx
// app/(dashboard)/new-feature/page.tsx
'use client';

import { useData } from '@/contexts/DataContext';
import { MyComponent } from '@/components/MyComponent';

export default function NewFeaturePage() {
  const { inventory } = useData();
  
  return <MyComponent inventory={inventory} />;
}
```

### Adding Sidebar Navigation

Update `components/Sidebar.tsx`:
```tsx
const navItems = [
  // ...existing items
  { id: 'NEW_FEATURE', label: 'New Feature', icon: MyIcon },
];
```

Update `app/(dashboard)/layout.tsx`:
```tsx
const pathToView = {
  // ...existing paths
  '/new-feature': 'NEW_FEATURE',
};

const viewToPath = {
  // ...existing views
  'NEW_FEATURE': '/new-feature',
};
```

## 🚦 Running the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The app runs on `http://localhost:3000` by default.

## 🔧 Environment Variables

Required in `.env.local`:

```bash
# Session Secret
SESSION_SECRET=your-32-character-secret

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

## 📚 Key Technologies

- **Next.js 14+** - React framework with App Router
- **React 18+** - UI library with Hooks and Context
- **TypeScript** - Type safety and IntelliSense
- **Tailwind CSS** - Utility-first styling
- **Firebase/Firestore** - Real-time database
- **Iron Session** - Encrypted session management
- **Bcrypt** - Password hashing
- **Lucide React** - Icon library

## 🎯 Benefits of This Architecture

1. **Scalability** - Easy to add new features and routes
2. **Maintainability** - Clear separation of concerns
3. **Performance** - Code splitting and lazy loading
4. **Type Safety** - Full TypeScript coverage
5. **Developer Experience** - Hot reload, fast refresh
6. **SEO Ready** - Server-side rendering support
7. **Security** - Protected routes and API endpoints
8. **State Management** - Centralized with React Context
9. **Real-time Updates** - Firestore subscriptions
10. **Error Recovery** - Graceful error handling

---

**Last Updated:** January 22, 2026  
**Status:** ✅ Production Ready
