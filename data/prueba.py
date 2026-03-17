import json
import re
from difflib import SequenceMatcher
import unicodedata

def normalize_text(text):
    """
    Normaliza el texto eliminando acentos, convirtiendo a mayúsculas
    y eliminando caracteres especiales para mejorar las comparaciones.
    """
    if not text:
        return ""
    
    # Convertir a string si no lo es
    text = str(text)
    
    # Convertir a mayúsculas
    text = text.upper()
    
    # Eliminar acentos
    text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
    
    # Eliminar caracteres especiales y espacios extras
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def calculate_similarity(str1, str2):
    """
    Calcula la similitud entre dos strings usando SequenceMatcher.
    """
    return SequenceMatcher(None, str1, str2).ratio()

def find_best_match(spanish_name, english_entries, threshold=0.7):
    """
    Encuentra la mejor coincidencia para un nombre español en la lista de entradas inglesas.
    """
    normalized_spanish = normalize_text(spanish_name)
    best_match = None
    best_score = 0
    
    for eng_entry in english_entries:
        eng_name = eng_entry.get('name', '')
        normalized_english = normalize_text(eng_name)
        
        # Calcular similitud
        score = calculate_similarity(normalized_spanish, normalized_english)
        
        # Verificar también si el nombre español está contenido en el inglés o viceversa
        if normalized_spanish in normalized_english or normalized_english in normalized_spanish:
            score = max(score, 0.8)
        
        if score > best_score and score >= threshold:
            best_score = score
            best_match = eng_entry
    
    return best_match, best_score

def main():
    print("Iniciando proceso de enriquecimiento del bestiario...")
    
    # Cargar archivo español
    try:
        with open('bestiario.json', 'r', encoding='utf-8') as f:
            spanish_data = json.load(f)
        print(f"✓ Archivo español cargado: {len(spanish_data)} entradas")
    except FileNotFoundError:
        print("✗ Error: No se encontró el archivo 'bestiario.json'")
        return
    except json.JSONDecodeError as e:
        print(f"✗ Error al parsear bestiario.json: {e}")
        return
    
    # Cargar archivo inglés
    try:
        with open('bestiario-eng.json', 'r', encoding='utf-8') as f:
            english_data = json.load(f)
        print(f"✓ Archivo inglés cargado: {len(english_data)} entradas")
    except FileNotFoundError:
        print("✗ Error: No se encontró el archivo 'bestiario-eng.json'")
        return
    except json.JSONDecodeError as e:
        print(f"✗ Error al parsear bestiario-eng.json: {e}")
        return
    
    # Estadísticas
    total_entries = len(spanish_data)
    matched_entries = 0
    unmatched_entries = []
    matched_with_url = 0
    
    # Procesar cada entrada en español
    for idx, spanish_entry in enumerate(spanish_data):
        spanish_name = spanish_entry.get('nombre', '')
        
        if not spanish_name:
            print(f"  ⚠ Entrada {idx} sin nombre, saltando...")
            continue
        
        # Buscar coincidencia
        best_match, score = find_best_match(spanish_name, english_data)
        
        if best_match and 'img_url' in best_match and best_match['img_url']:
            # Agregar img_url a la entrada española
            spanish_entry['img_url'] = best_match['img_url']
            matched_entries += 1
            if best_match['img_url']:
                matched_with_url += 1
            print(f"  ✓ '{spanish_name}' → imagen encontrada (similitud: {score:.2f})")
        else:
            unmatched_entries.append(spanish_name)
            print(f"  ✗ '{spanish_name}' → NO se encontró imagen")
    
    # Guardar archivo actualizado
    output_file = 'bestiario_enriquecido.json'
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(spanish_data, f, ensure_ascii=False, indent=2)
        print(f"\n✓ Archivo guardado: {output_file}")
    except Exception as e:
        print(f"✗ Error al guardar el archivo: {e}")
    
    # Mostrar estadísticas finales
    print("\n" + "="*50)
    print("ESTADÍSTICAS FINALES")
    print("="*50)
    print(f"Total de entradas en español: {total_entries}")
    print(f"Entradas con imagen encontrada: {matched_entries} ({matched_entries/total_entries*100:.1f}%)")
    print(f"  - Con URL válida: {matched_with_url}")
    print(f"Entradas sin imagen: {len(unmatched_entries)} ({len(unmatched_entries)/total_entries*100:.1f}%)")
    
    if unmatched_entries:
        print("\nEntradas sin imagen encontrada:")
        for name in unmatched_entries:
            print(f"  • {name}")
    
    # También guardar lista de no encontrados
    if unmatched_entries:
        with open('no_encontrados.txt', 'w', encoding='utf-8') as f:
            f.write("ENTRADAS SIN IMAGEN ENCONTRADA:\n")
            f.write("="*40 + "\n")
            for name in unmatched_entries:
                f.write(f"{name}\n")
        print(f"\n✓ Lista de no encontrados guardada en 'no_encontrados.txt'")

def test_matches():
    """
    Función de prueba para verificar algunas coincidencias específicas
    """
    print("\n" + "="*50)
    print("PRUEBAS DE COINCIDENCIAS")
    print("="*50)
    
    test_cases = [
        ("DRAGÓN AZUL ADULTO", "Adult Blue Dragon"),
        ("ABOLETH", "Aboleth"),
        ("ACÓLITO", "Acolyte"),
        ("DRAGÓN DE BRONCE ADULTO", "Adult Bronze Dragon"),
    ]
    
    for spanish, english in test_cases:
        norm_spanish = normalize_text(spanish)
        norm_english = normalize_text(english)
        score = calculate_similarity(norm_spanish, norm_english)
        print(f"'{spanish}' vs '{english}': {score:.2f}")

if __name__ == "__main__":
    print("="*50)
    print("ENRIQUECEDOR DE BESTIARIO D&D")
    print("="*50)
    
    # Ejecutar pruebas primero (opcional)
    # test_matches()
    
    # Ejecutar el proceso principal
    main()
    
    print("\n¡Proceso completado!")