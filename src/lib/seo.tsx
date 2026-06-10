import { useEffect } from 'react';
import type { Listing } from './types';

// Lightweight, dependency-free per-route head manager. Each page renders one
// <Seo /> which upserts title / description / canonical / Open Graph / Twitter
// tags and (optionally) a route-scoped JSON-LD block. The static index.html
// carries the homepage defaults + site-wide Organization/WebSite JSON-LD for
// crawlers and social scrapers that don't execute JS; this component layers the
// per-route values on top for Google (which renders JS) and for users.

export const SITE_URL = 'https://homesconnect.co.za';
export const SITE_NAME = 'HomesConnect';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

type SeoProps = {
  title: string;
  description: string;
  /** Route path for the canonical URL, e.g. '/listings'. Defaults to current path. */
  path?: string;
  /** Absolute URL or root-relative path; falls back to the site share image. */
  image?: string;
  /** og:type — 'website' for most pages, 'article'/'product' for detail pages. */
  type?: string;
  jsonLd?: object | object[] | null;
  noindex?: boolean;
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function canonicalFor(path: string): string {
  if (path === '/' || path === '') return `${SITE_URL}/`;
  return SITE_URL + (path.startsWith('/') ? path : `/${path}`).replace(/\/+$/, '');
}

const JSONLD_ID = 'route-jsonld';

export default function Seo({
  title,
  description,
  path,
  image,
  type = 'website',
  jsonLd = null,
  noindex = false,
}: SeoProps) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    const p = path ?? window.location.pathname;
    const canonical = canonicalFor(p);
    const img = image ? (image.startsWith('http') ? image : SITE_URL + image) : DEFAULT_IMAGE;

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow');
    upsertLink('canonical', canonical);

    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:image', img);
    upsertMeta('property', 'og:site_name', SITE_NAME);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', img);

    // Replace any previous route JSON-LD (leave the static site-wide block alone).
    document.getElementById(JSONLD_ID)?.remove();
    if (ld) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.id = JSONLD_ID;
      s.text = ld;
      document.head.appendChild(s);
    }
  }, [title, description, path, image, type, noindex, ld]);

  return null;
}

/** Build clean schema.org JSON-LD for a single property listing. */
export function listingJsonLd(l: Listing): object {
  const canonical = `${SITE_URL}/listing/${l.id}`;
  const images = [l.imageUrl, l.image2, l.image3].filter(Boolean);
  const locality = l.suburb || l.city;
  const isApartment = /apartment|flat|unit/i.test(l.propertyType);

  const accommodation: Record<string, unknown> = {
    '@type': isApartment ? 'Apartment' : 'House',
    name: l.title,
    numberOfBedrooms: l.bedrooms || undefined,
    numberOfBathroomsTotal: l.bathrooms || undefined,
    numberOfRooms: l.bedrooms || undefined,
    petsAllowed: l.petFriendly || undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: locality || undefined,
      addressRegion: l.province || undefined,
      addressCountry: 'ZA',
    },
  };
  if (l.sizeSqm) {
    accommodation.floorSize = { '@type': 'QuantitativeValue', value: l.sizeSqm, unitCode: 'MTK' };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: l.title,
    url: canonical,
    description: (l.description || `${l.title} in ${locality}, ${l.province}.`).slice(0, 300),
    image: images.length ? images : undefined,
    datePosted: l.dateListed || undefined,
    ...(l.price
      ? {
          offers: {
            '@type': 'Offer',
            price: l.price,
            priceCurrency: 'ZAR',
            availability: 'https://schema.org/InStock',
            url: canonical,
            ...(l.type === 'rent'
              ? { businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut' }
              : { businessFunction: 'http://purl.org/goodrelations/v1#Sell' }),
          },
        }
      : {}),
    about: accommodation,
  };
}
