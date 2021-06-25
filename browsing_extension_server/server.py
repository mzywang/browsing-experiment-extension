import logging
import os
import gevent
import json
import psycopg2
import re
import csv
from flask import Flask, render_template
from flask_sockets import Sockets

app = Flask(__name__)
app.debug = 'DEBUG' in os.environ

socket = Sockets(app)

BLACKLIST = ['mail.google.com', 'docs.google.com', 'drive.google.com', 'onenote.com', 'office.com']

DOMAIN_TO_CATEGORY_MAP = {}

reader = csv.DictReader(open('categories.csv'))

for row in reader:
    DOMAIN_TO_CATEGORY_MAP[row['Domain'].lower()] = row['Category']

def is_blacklist(url):
    for domain in BLACKLIST:
        if domain in url:
            return True
    return False

def get_category(domain):
    if domain in DOMAIN_TO_CATEGORY_MAP:
        return DOMAIN_TO_CATEGORY_MAP[domain]
    else:
        return "uncategorized"

@app.route('/')
def hello():
    print("Hello World")
    return 'Hello, World!'

@socket.route('/submit')
def inbox(ws):
    while not ws.closed:
        gevent.sleep(0.1)
        message = ws.receive()

        print('checking inbox..\n')

        if message:
            try:
                parsed = json.loads(message)
                pretty_json = json.dumps(parsed, indent = 2, sort_keys = True)
                print('Received message {}\n'.format(pretty_json))
                try:
                    conn = psycopg2.connect("dbname='da1ic5u1er71m5' user='jkfiavqbswhwli' host='ec2-54-225-76-201.compute-1.amazonaws.com' password='3431df1b8d73007671a172afd53bba219861bc0f85a90ca0185f63cd5769f609' port='5432' sslmode='require'")
                    print("Successfully connected to the database")
                    cur = conn.cursor()

                    insert_string = ""
                    data_tuple = ()

                    if (parsed['action'] == 'scroll' or parsed['action'] == 'type'):
                        domain = parsed['domain']
                        url = parsed['url']
                        domain_or_url = domain if is_blacklist(url) else url
                        data = parsed['data'].encode('utf-8')
                        if is_blacklist(url):
                            print("BLACKLISTED URL")
                        if is_blacklist(url) and isinstance(data, basestring):
                            regex = '(title=".*?")'
                            results = re.findall(regex, data)
                            for result in results:
                                data = data.replace(result, '')
                        category = get_category(domain)
                        insert_string = """
                            INSERT INTO events(action_type, tab_id, user_id, timestamp_start, timestamp_end, times, url, category)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        data_tuple = (parsed['action'], parsed['tabId'], parsed['uid'], parsed['timestamp_start'], parsed['timestamp_end'], parsed['times'], domain_or_url, category)
                    elif (parsed['action'] == 'click'):
                        domain = parsed['domain']
                        url = parsed['url']
                        domain_or_url = domain if is_blacklist(url) else url
                        data = parsed['data'].encode('utf-8')
                        if is_blacklist(url):
                            print("BLACKLISTED URL")
                        if is_blacklist(url) and isinstance(data, basestring):
                            regex = '(title=".*?")'
                            results = re.findall(regex, data)
                            for result in results:
                                data = data.replace(result, '')
                        category = get_category(domain)
                        insert_string = """
                            INSERT INTO events(action_type, tab_id, user_id, timestamp_start, timestamp_end, url, data, category)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        data_tuple = (parsed['action'], parsed['tabId'], parsed['uid'], parsed['timestamp'], parsed['timestamp'], domain_or_url, data, category)
                    elif (parsed['action'] == 'urlChange'):
                        domain = parsed['domain']
                        url = parsed['url']
                        domain_or_url = domain if is_blacklist(url) else url
                        if is_blacklist(url):
                            print("BLACKLISTED URL")
                        category = get_category(domain)
                        insert_string = """
                            INSERT INTO events(action_type, tab_id, user_id, timestamp_start, timestamp_end, url, category)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """
                        data_tuple = (parsed['action'], parsed['tabId'], parsed['uid'], parsed['timestamp'], parsed['timestamp'], domain_or_url, category)
                    else:
                        insert_string = """
                            INSERT INTO events(action_type, tab_id, user_id, timestamp_start, timestamp_end)
                            VALUES (%s, %s, %s, %s, %s)
                        """
                        data_tuple = (parsed['action'], parsed['tabId'], parsed['uid'], parsed['timestamp'], parsed['timestamp'])
                    print("Executing: {}".format(insert_string))
                    cur.execute(insert_string, data_tuple)
                    conn.commit()
                    cur.close()
                except Exception, e:
                    print str(e)
                    print("I am unable to connect to the database")
            except Exception, e:
                print str(e)
                print('Received message with invalid JSON\n')
