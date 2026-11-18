import beam from '@/assets/example-beam.jpg';
import column from '@/assets/example-column.jpg';
import bracing from '@/assets/example-bracing.jpg';
import { compressPhoto, type Report } from './report-model';

export async function makeExampleReport(): Promise<Report> {
  const definitions = [
    { id: 'example-beam', code: 'VM-001', name: 'Viga metálica galvanizada', location: 'Galpão A · Eixo 1', condition: 'Boa' as const, quantity: 4, notes: 'Acabamento galvanizado uniforme, sem deformações aparentes. Registro visual ilustrativo; não substitui avaliação técnica.', image: beam, caption: 'Vista geral da viga metálica galvanizada.' },
    { id: 'example-column', code: 'PL-002', name: 'Pilar metálico com placa de base', location: 'Galpão A · Eixo 2', condition: 'Regular' as const, quantity: 6, notes: 'Oxidação superficial na região da solda e da placa de base. No exemplo, recomenda-se limpeza e revisão da proteção anticorrosiva.', image: column, caption: 'Detalhe da placa de base e da solda do pilar.' },
    { id: 'example-bracing', code: 'CT-003', name: 'Contraventamento metálico', location: 'Galpão A · Fachada lateral', condition: 'Ruim' as const, quantity: 2, notes: 'Pintura desgastada e pontos de corrosão nas extremidades. No exemplo, encaminhar para avaliação técnica antes de liberar a montagem.', image: bracing, caption: 'Vista do contraventamento com desgaste da pintura e oxidação.' },
  ];
  const pieces = await Promise.all(definitions.map(async ({ image, caption, ...piece }) => {
    const response = await fetch(image);
    if (!response.ok) throw new Error('Não foi possível carregar a foto de exemplo.');
    const photo = await compressPhoto(new File([await response.blob()], `${piece.code}.jpg`, { type: 'image/jpeg' }));
    return { ...piece, photos: [{ ...photo, caption }] };
  }));
  return { title: 'Inspeção de peças — Estrutura do Galpão A', client: 'Metalúrgica Horizonte · Cuiabá / MT (exemplo)', date: '2026-11-18', responsible: 'Guilherme Alves Rezende', notes: 'RELATÓRIO DE DEMONSTRAÇÃO — dados fictícios e imagens ilustrativas geradas por IA. Exemplo de registro visual de peças da estrutura metálica antes da montagem, com identificação, condição e observações por item.', pieces };
}