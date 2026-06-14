import { describe, it, expect } from 'vitest';
import { parseListing, extractIdealistaId } from './parse-listing';

const URL = 'https://www.idealista.com/inmueble/106543210/';

const HTML = `<!doctype html><html><body>
  <span class="main-info__title-main">Piso en venta en calle de Prueba</span>
  <span class="main-info__title-minor">Barrio Test, Madrid</span>
  <span class="info-data-price">320.000<span>€</span></span>
  <ul><li class="header-map-list">Barrio Test</li><li class="header-map-list">Madrid</li></ul>
  <div class="info-features"><span>3 hab.</span><span>90 m²</span><span>1ª planta exterior</span></div>
  <div class="comment"><p>Bonito piso.<br>Muy luminoso.</p></div>
  <section class="details-property_features"><ul>
    <li>Ascensor</li><li>Aire acondicionado</li><li>Calefacción individual: gas natural</li>
    <li>Trastero</li><li>Garaje incluido</li><li>1ª planta exterior</li>
  </ul></section>
  <a class="about-advertiser-name">Inmobiliaria Test</a>
  <div class="professional-name"><span class="name">Profesional</span></div>
  <a href="tel:+34911234567">Llamar</a>
  <script>var x = { fullScreenGalleryPics: [
    { imageDataService:"https://img.idealista.com/a.jpg" },
    { imageDataService:"https://img.idealista.com/b.jpg" }
  ] };</script>
</body></html>`;

describe('extractIdealistaId', () => {
  it('pulls the numeric id from a listing url', () => {
    expect(extractIdealistaId(URL)).toBe('106543210');
  });
  it('throws on a non-listing url', () => {
    expect(() => extractIdealistaId('https://www.idealista.com/')).toThrow();
  });
});

describe('parseListing', () => {
  const apt = parseListing(HTML, URL);

  it('extracts the core fields', () => {
    expect(apt.idealistaId).toBe('106543210');
    expect(apt.url).toBe(URL);
    expect(apt.title).toBe('Piso en venta en calle de Prueba');
    expect(apt.price).toBe(320000);
    expect(apt.location).toBe('Barrio Test, Madrid');
    expect(apt.rooms).toBe(3);
    expect(apt.squareMeters).toBe(90);
    expect(apt.floor).toBe('1ª planta exterior');
  });

  it('preserves description line breaks', () => {
    expect(apt.description).toBe('Bonito piso.\nMuy luminoso.');
  });

  it('reads the contact from the post-phone-click html', () => {
    expect(apt.contactName).toBe('Inmobiliaria Test');
    expect(apt.contactType).toBe('inmobiliaria');
    expect(apt.contactPhone).toBe('+34911234567');
  });

  it('maps the boolean feature checklist', () => {
    expect(apt.elevator).toBe(true);
    expect(apt.airConditioning).toBe(true);
    expect(apt.naturalGas).toBe(true);
    expect(apt.parking).toBe(true);
    expect(apt.storageRoom).toBe(true);
    expect(apt.pool).toBeNull();
    expect(apt.heating).toBe('gas');
  });

  it('extracts gallery photo urls', () => {
    expect(apt.photoUrls).toEqual([
      'https://img.idealista.com/a.jpg',
      'https://img.idealista.com/b.jpg',
    ]);
  });
});
