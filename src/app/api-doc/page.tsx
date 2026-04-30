import { getApiDocs } from '@/lib/swagger';
import ReactSwagger from './react-swagger';

export default async function ApiDocPage() {
  const spec = await getApiDocs();
  const specRecord = spec as Record<string, unknown>;
  return (
    <section className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Phidias API Documentation</h1>
        <ReactSwagger spec={specRecord} />
      </div>
    </section>
  );
}
