import type { Metadata } from 'next';
import ApiDocsClient from './ApiDocsClient';

export const metadata: Metadata = {
  title: 'API Documentation | FeroxStats',
  description: 'Production-style API reference for FeroxStats endpoints.',
};

export default function ApiDocsPage() {
  return <ApiDocsClient />;
}