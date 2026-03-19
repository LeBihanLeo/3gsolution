'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from 'react';

export interface CartOption {
  nom: string;
  prix: number; // centimes
}

export interface CartItem {
  produitId: string;
  nom: string;
  prix: number; // prix de base en centimes
  quantite: number;
  options: CartOption[];
  imageUrl?: string;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { produitId: string; optionsKey: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { produitId: string; optionsKey: string; quantite: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartItem[] };

function buildOptionsKey(options: CartOption[]): string {
  return [...options]
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .map((o) => `${o.nom}:${o.prix}`)
    .join('|');
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const key = buildOptionsKey(action.payload.options);
      const idx = state.items.findIndex(
        (i) =>
          i.produitId === action.payload.produitId &&
          buildOptionsKey(i.options) === key
      );
      if (idx >= 0) {
        const updated = [...state.items];
        updated[idx] = {
          ...updated[idx],
          quantite: updated[idx].quantite + action.payload.quantite,
        };
        return { items: updated };
      }
      return { items: [...state.items, action.payload] };
    }

    case 'REMOVE_ITEM':
      return {
        items: state.items.filter(
          (i) =>
            !(
              i.produitId === action.payload.produitId &&
              buildOptionsKey(i.options) === action.payload.optionsKey
            )
        ),
      };

    case 'UPDATE_QUANTITY': {
      if (action.payload.quantite <= 0) {
        return {
          items: state.items.filter(
            (i) =>
              !(
                i.produitId === action.payload.produitId &&
                buildOptionsKey(i.options) === action.payload.optionsKey
              )
          ),
        };
      }
      return {
        items: state.items.map((i) =>
          i.produitId === action.payload.produitId &&
          buildOptionsKey(i.options) === action.payload.optionsKey
            ? { ...i, quantite: action.payload.quantite }
            : i
        ),
      };
    }

    case 'CLEAR_CART':
      return { items: [] };

    case 'LOAD_CART':
      return { items: action.payload };

    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (produitId: string, options: CartOption[]) => void;
  updateQuantity: (produitId: string, options: CartOption[], quantite: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number; // en centimes
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Hydratation depuis localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('panier');
      if (stored) {
        dispatch({ type: 'LOAD_CART', payload: JSON.parse(stored) as CartItem[] });
      }
    } catch {
      // Ignore les erreurs de parsing
    }
  }, []);

  // Persistance à chaque changement
  useEffect(() => {
    localStorage.setItem('panier', JSON.stringify(state.items));
  }, [state.items]);

  const addItem = (item: CartItem) => dispatch({ type: 'ADD_ITEM', payload: item });

  const removeItem = (produitId: string, options: CartOption[]) =>
    dispatch({ type: 'REMOVE_ITEM', payload: { produitId, optionsKey: buildOptionsKey(options) } });

  const updateQuantity = (produitId: string, options: CartOption[], quantite: number) =>
    dispatch({
      type: 'UPDATE_QUANTITY',
      payload: { produitId, optionsKey: buildOptionsKey(options), quantite },
    });

  const clearCart = () => dispatch({ type: 'CLEAR_CART' });

  const totalItems = state.items.reduce((sum, i) => sum + i.quantite, 0);
  const totalPrice = state.items.reduce(
    (sum, i) =>
      sum + (i.prix + i.options.reduce((s, o) => s + o.prix, 0)) * i.quantite,
    0
  );

  return (
    <CartContext.Provider
      value={{ items: state.items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart doit être utilisé dans un CartProvider');
  return ctx;
}

export { buildOptionsKey };
