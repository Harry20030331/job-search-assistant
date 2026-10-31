"""Fictional Gmail/Calendar protocol doubles. No sockets, OAuth or Google calls."""
from __future__ import annotations

import base64
import copy
from email.message import EmailMessage
from email.policy import SMTP
from types import SimpleNamespace


class HTTPFailure(Exception):
    def __init__(self, status):
        self.resp = SimpleNamespace(status=status)
        super().__init__("Virtual service failure")


class Request:
    def __init__(self, call):
        self.call, self.headers = call, {}

    def execute(self, num_retries=0):
        if num_retries:
            raise AssertionError("Unexpected automatic transport retry")
        return copy.deepcopy(self.call(self))


class Resource:
    def __init__(self, service, kind): self.service, self.kind = service, kind
    def get(self, **kwargs): return self.service.request(self.kind + ".get", kwargs)
    def list(self, **kwargs): return self.service.request(self.kind + ".list", kwargs)


class VirtualMailbox:
    def __init__(self, address="candidate@virtual.example.invalid", page_size=2):
        self.address, self.page_size = address, page_size
        self.messages_by_id, self.deliveries, self.calls, self.failures = {}, [], [], {}
        self.cursor = 100

    def deliver(self, message_id, body, *, thread="thread-1", subject="Fictional recruiting message", html=False):
        if message_id in self.messages_by_id:
            return False
        message = EmailMessage(policy=SMTP)
        message["From"] = "Fictional recruiter <recruiter@employer.example.invalid>"
        message["To"], message["Subject"] = self.address, subject
        message["Message-ID"] = "<" + message_id + "@virtual.example.invalid>"
        message.set_content(body, subtype="html" if html else "plain")
        self.cursor += 1
        self.messages_by_id[message_id] = {"id": message_id, "threadId": thread, "internalDate": str(self.cursor * 1000),
            "labelIds": ["INBOX", "UNREAD"], "raw": base64.urlsafe_b64encode(message.as_bytes()).decode().rstrip("=")}
        self.deliveries.append((self.cursor, message_id))
        return True

    def users(self): return self
    def messages(self): return Resource(self, "messages")
    def threads(self): return Resource(self, "threads")
    def history(self): return Resource(self, "history")
    def getProfile(self, **kwargs): return self.request("profile", kwargs)

    def request(self, operation, kwargs):
        def execute(request):
            self.calls.append({"operation": operation, "arguments": kwargs})
            if self.failures.get(operation): raise HTTPFailure(self.failures[operation].pop(0))
            if operation == "profile": return {"emailAddress": self.address, "historyId": str(self.cursor)}
            if operation == "messages.get":
                if kwargs["id"] not in self.messages_by_id: raise HTTPFailure(404)
                return self.messages_by_id[kwargs["id"]]
            if operation == "threads.get":
                return {"id": kwargs["id"], "messages": [{"id": key} for key, value in self.messages_by_id.items() if value["threadId"] == kwargs["id"]]}
            if operation == "messages.list":
                rows = [{"id": key, "threadId": value["threadId"]} for key, value in self.messages_by_id.items()]
                offset = int(kwargs.get("pageToken", "0")); page = {"messages": rows[offset:offset + self.page_size]}
                if offset + self.page_size < len(rows): page["nextPageToken"] = str(offset + self.page_size)
                return page
            if operation == "history.list":
                rows = [{"id": str(cursor), "messagesAdded": [{"message": {"id": key, "threadId": self.messages_by_id[key]["threadId"]}}]}
                        for cursor, key in self.deliveries if cursor > int(kwargs["startHistoryId"])]
                offset = int(kwargs.get("pageToken", "0")); page = {"history": rows[offset:offset + self.page_size], "historyId": str(self.cursor)}
                if offset + self.page_size < len(rows): page["nextPageToken"] = str(offset + self.page_size)
                return page
            raise AssertionError("Virtual mailbox has no mail mutation or send operation")
        return Request(execute)


class VirtualCalendar:
    def __init__(self):
        self.remote, self.calls, self.failures = {}, [], {}
        self.concurrent_edit = False
        self.corrupt_readback = False

    def events(self): return self
    def get(self, **kwargs): return self.request("get", kwargs)
    def list(self, **kwargs): return self.request("list", kwargs)
    def insert(self, **kwargs): return self.request("insert", kwargs)
    def patch(self, **kwargs): return self.request("patch", kwargs)

    def request(self, operation, kwargs):
        def execute(request):
            self.calls.append({"operation": operation, "arguments": kwargs, "if_match": request.headers.get("If-Match")})
            if self.failures.get(operation): raise HTTPFailure(self.failures[operation].pop(0))
            if operation == "list": return {"timeZone": "UTC", "items": list(self.remote.values())}
            if operation == "get":
                if kwargs["eventId"] not in self.remote: raise HTTPFailure(404)
                return self.remote[kwargs["eventId"]]
            if kwargs.get("sendUpdates") != "none": raise AssertionError("Must not invite attendees")
            body = copy.deepcopy(kwargs["body"])
            if operation == "insert":
                key = body["id"]
                if key in self.remote: raise HTTPFailure(409)
                body.update(etag='"v1"', status="confirmed")
                self.remote[key] = body
            elif operation == "patch":
                key = kwargs["eventId"]
                if key not in self.remote: raise HTTPFailure(404)
                if self.concurrent_edit: self.remote[key]["etag"] = '"external-edit"'
                if request.headers.get("If-Match") != self.remote[key]["etag"]: raise HTTPFailure(412)
                self.remote[key].update(body, etag='"v2"')
            else: raise AssertionError("Unsupported virtual calendar operation")
            if self.corrupt_readback: self.remote[key]["summary"] = "Simulated conflicting server result"
            return self.remote[key]
        return Request(execute)
