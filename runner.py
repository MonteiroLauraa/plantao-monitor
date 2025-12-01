import os
import time
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import schedule

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        print(f" Erro : {e}")
        return None

def executar_regra(conn, regra):
    cursor = conn.cursor()
    inicio = time.strftime('%Y-%m-%d %H:%M:%S')
    
    print(f" [Runner] Executando regra {regra['id_regra']}: {regra['nome']}")
    
    try:
      
        cursor.execute(regra['sql'])
        rows = cursor.fetchall()
        count = len(rows) 
        resultado_json = json.dumps(rows, default=str) 
        
        fim = time.strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("""
            INSERT INTO regras_execucoes 
            (id_regra, timestamp_inicio, timestamp_fim, status, resultado_count)
            VALUES (%s, %s, %s, %s, %s)
        """, (regra['id_regra'], inicio, fim, 'sucesso', count))
   
        if count > 0:
            print(f" ALERTA! Encontrados {count} registros.")
            
           
            cursor.execute("""
                SELECT id FROM incidentes 
                WHERE id_regra = %s AND status != 'CLOSED'
            """, (regra['id_regra'],))
            
            incidente_aberto = cursor.fetchone()
            
            if not incidente_aberto:
                cursor.execute("""
                    INSERT INTO incidentes (id_regra, status, prioridade, detalhes)
                    VALUES (%s, 'OPEN', %s, %s)
                """, (regra['id_regra'], regra['prioridade'], f"Python Runner encontrou {count} ocorrências."))
                print(" Incidente criado!")
            else:
                print("  Incidente já existe. Pulando.")

        conn.commit()

    except Exception as e:
        conn.rollback()
        fim = time.strftime('%Y-%m-%d %H:%M:%S')
        print(f"  Erro na execução: {e}")
    
        try:
            cursor.execute("""
                INSERT INTO regras_execucoes 
                (id_regra, timestamp_inicio, timestamp_fim, status, erro_log)
                VALUES (%s, %s, %s, 'erro', %s)
            """, (regra['id_regra'], inicio, fim, str(e)))
            conn.commit()
        except:
            pass 

def job_monitoramento():
    print("\n Iniciando monitoramento...")
    conn = get_db_connection()
    if not conn:
        return

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM regras WHERE ativo = true")
        regras = cursor.fetchall()
        
        print(f"Encontradas {len(regras)} regras ativas.")
        
        for regra in regras:
            executar_regra(conn, regra)
            
    except Exception as e:
        print(f"Erro no Job: {e}")
    finally:
        conn.close()

schedule.every(1).minutes.do(job_monitoramento)

print(" Python iniciado! Aguardando agendamento...")
job_monitoramento() 

while True:
    schedule.run_pending()
    time.sleep(1)